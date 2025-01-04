from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import requests
import re
import json
from urllib.parse import unquote, parse_qs, urlparse
import logging
import time
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FacebookDownloaderException(Exception):
    pass

def create_session():
    """Create a session with proper headers and cookies."""
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    })
    return session

def clean_url(url):
    """Clean and normalize Facebook URL."""
    # Handle fb.watch URLs
    if 'fb.watch' in url:
        session = create_session()
        response = session.get(url, allow_redirects=True)
        url = response.url
    
    # Remove tracking parameters
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    
    # Keep only essential parameters
    essential_params = {'v', 'video_id', 'id'}
    filtered_query = {k: v for k, v in query.items() if k in essential_params}
    
    # Rebuild URL
    from urllib.parse import urlencode
    clean_query = urlencode(filtered_query, doseq=True) if filtered_query else ''
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}{'?' + clean_query if clean_query else ''}"

def extract_video_url(html_content, url):
    """Extract video URLs using multiple patterns and methods."""
    video_urls = {'hd_url': None, 'sd_url': None}
    
    # Method 1: Direct regex patterns
    patterns = [
        # HD quality patterns
        r'playable_url_quality_hd[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        r'hd_src[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        r'HD_URL[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        # SD quality patterns
        r'playable_url[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        r'sd_src[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        r'SD_URL[\"\']\s*:\s*[\"\'](.*?)[\"\']',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, html_content, re.IGNORECASE)
        if matches:
            url = unquote(matches[0].replace('\\u0025', '%').replace('\\/', '/'))
            if 'hd' in pattern.lower() and not video_urls['hd_url']:
                video_urls['hd_url'] = url
            elif not video_urls['sd_url']:
                video_urls['sd_url'] = url

    # Method 2: Extract from video data JSON
    try:
        video_data = re.search(r'videoData:\s*(\[.*?\])', html_content)
        if video_data:
            data = json.loads(video_data.group(1))
            for item in data:
                if isinstance(item, dict):
                    if item.get('hd_url') and not video_urls['hd_url']:
                        video_urls['hd_url'] = item['hd_url']
                    if item.get('sd_url') and not video_urls['sd_url']:
                        video_urls['sd_url'] = item['sd_url']
    except:
        pass

    # Method 3: Try to extract from graphql data
    try:
        graphql_data = re.search(r'{\s*"graphql":\s*({.*?})}', html_content)
        if graphql_data:
            data = json.loads(graphql_data.group(1))
            video_element = data.get('video', {})
            if video_element.get('playable_url_quality_hd'):
                video_urls['hd_url'] = video_element['playable_url_quality_hd']
            if video_element.get('playable_url'):
                video_urls['sd_url'] = video_element['playable_url']
    except:
        pass

    return video_urls

def get_video_title(html_content):
    """Extract video title from HTML content."""
    patterns = [
        r'<title>(.*?)</title>',
        r'og:title"\s+content="([^"]+)"',
        r'pageTitle">([^<]+)<',
        r'<h2[^>]*class="[^"]*text-title[^"]*"[^>]*>(.*?)</h2>',
        r'<span[^>]*id="[^"]*video-title[^"]*"[^>]*>(.*?)</span>'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html_content)
        if match:
            title = match.group(1).strip()
            # Clean the title
            title = re.sub(r'\s+', ' ', title)  # Remove extra whitespace
            title = re.sub(r'[<>:"/\\|?*]', '', title)  # Remove invalid filename characters
            return title[:100] if title else "Facebook Video"  # Limit length
    
    return "Facebook Video"

def is_valid_facebook_url(url):
    """Validate if the URL is a Facebook video URL."""
    patterns = [
        r'^https?://(www\.)?(facebook\.com|fb\.watch)/.+$',
        r'^https?://(www\.)?facebook\.com/.*?/videos/.+$',
        r'^https?://(www\.)?facebook\.com/watch/\?v=\d+$',
        r'^https?://(www\.)?facebook\.com/[^/]+/posts/\d+$',
        r'^https?://(www\.)?facebook\.com/watch\?v=\d+$'
    ]
    
    return any(re.match(pattern, url, re.IGNORECASE) for pattern in patterns)

def home(request):
    return render(request, 'downloader/home.html')

@csrf_exempt
def download_video(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Invalid request method'})
    
    try:
        data = json.loads(request.body)
        url = data.get('url', '').strip()
        
        if not url:
            raise FacebookDownloaderException('URL is required')
            
        if not is_valid_facebook_url(url):
            raise FacebookDownloaderException('Invalid Facebook video URL')
        
        # Clean the URL
        url = clean_url(url)
        
        # Create a session with proper headers
        session = create_session()
        
        # Try to fetch the video page
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = session.get(url, timeout=15)
                response.raise_for_status()
                html_content = response.text
                
                # Extract video URLs
                video_urls = extract_video_url(html_content, url)
                
                if not video_urls['sd_url'] and not video_urls['hd_url']:
                    if attempt < max_retries - 1:
                        time.sleep(2)  # Wait before retrying
                        continue
                    raise FacebookDownloaderException('No video found or video might be private')
                
                # Get video title
                video_title = get_video_title(html_content)
                
                return JsonResponse({
                    'success': True,
                    'sd_url': video_urls['sd_url'],
                    'hd_url': video_urls['hd_url'],
                    'title': video_title
                })
            
            except requests.RequestException:
                if attempt < max_retries - 1:
                    time.sleep(2)  # Wait before retrying
                    continue
                raise
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON data received")
        return JsonResponse({'success': False, 'error': 'Invalid request data'})
        
    except requests.RequestException as e:
        logger.error(f"Request failed: {str(e)}")
        return JsonResponse({'success': False, 'error': 'Failed to fetch video data. Please try again.'})
        
    except FacebookDownloaderException as e:
        logger.error(f"Facebook downloader error: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return JsonResponse({'success': False, 'error': 'An unexpected error occurred'})

@csrf_exempt
def validate_url(request):
    if request.method != 'POST':
        return JsonResponse({'valid': False, 'error': 'Invalid request method'})
    
    try:
        data = json.loads(request.body)
        url = data.get('url', '').strip()
        
        valid = is_valid_facebook_url(url)
        return JsonResponse({'valid': valid})
        
    except Exception as e:
        logger.error(f"URL validation error: {str(e)}")
        return JsonResponse({'valid': False, 'error': str(e)})

@ensure_csrf_cookie
def reels(request):
    return render(request, 'downloader/reels.html')
@require_http_methods(["POST"])

def download_reel(request):
    if request.method != 'POST':
            return download_video(request)

    
    try:
        data = json.loads(request.body)
        url = data.get('url', '').strip()
        
        if not url:
            raise FacebookDownloaderException('URL is required')
            
        if not is_valid_reel_url(url):
            raise FacebookDownloaderException('Invalid Facebook Reel URL')
        
        # Create a session with proper headers
        session = create_session()
        
        # Try to fetch the reel
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = session.get(url, timeout=15)
                response.raise_for_status()
                html_content = response.text
                
                # Extract video URLs
                video_urls = extract_reel_url(html_content, url)
                
                if not video_urls['sd_url'] and not video_urls['hd_url']:
                    if attempt < max_retries - 1:
                        time.sleep(2)
                        continue
                    raise FacebookDownloaderException('No video found or reel might be private')
                
                # Get reel title
                reel_title = get_reel_title(html_content)
                
                return JsonResponse({
                    'success': True,
                    'sd_url': video_urls['sd_url'],
                    'hd_url': video_urls['hd_url'],
                    'title': reel_title
                })
            
            except requests.RequestException:
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                raise
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON data received")
        return JsonResponse({'success': False, 'error': 'Invalid request data'})
        
    except requests.RequestException as e:
        logger.error(f"Request failed: {str(e)}")
        return JsonResponse({'success': False, 'error': 'Failed to fetch reel. Please try again.'})
        
    except FacebookDownloaderException as e:
        logger.error(f"Facebook downloader error: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return JsonResponse({'success': False, 'error': 'An unexpected error occurred'})

def is_valid_reel_url(url):
    patterns = [
        r'^https?://(www\.)?(facebook\.com|fb\.watch)/.+$',
        r'^https?://(www\.)?facebook\.com/[^/]+/videos/.+$',
        r'^https?://(www\.)?facebook\.com/reel/.+$',
        r'^https?://(www\.)?facebook\.com/[^/]+/posts/.+$'
    ]
    return any(re.match(pattern, url, re.IGNORECASE) for pattern in patterns)


def extract_reel_url(html_content, url):
    video_urls = {'hd_url': None, 'sd_url': None}
    
    patterns = [
        # HD quality patterns
        r'playable_url_quality_hd[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        r'hd_src[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        # SD quality patterns
        r'playable_url[\"\']\s*:\s*[\"\'](.*?)[\"\']',
        r'sd_src[\"\']\s*:\s*[\"\'](.*?)[\"\']',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, html_content, re.IGNORECASE)
        if matches:
            url = unquote(matches[0].replace('\\u0025', '%').replace('\\/', '/'))
            if 'hd' in pattern.lower() and not video_urls['hd_url']:
                video_urls['hd_url'] = url
            elif not video_urls['sd_url']:
                video_urls['sd_url'] = url

    return video_urls

def get_reel_title(html_content):
    patterns = [
        r'<title>(.*?)</title>',
        r'og:title"\s+content="([^"]+)"',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html_content)
        if match:
            title = match.group(1).strip()
            title = re.sub(r'\s+', ' ', title)
            title = re.sub(r'[<>:"/\\|?*]', '', title)
            return title[:100] if title else "Facebook Reel"
    
    return "Facebook Reel"

def about(request):
    return render(request, 'about.html')

def terms(request):
    return render(request, 'terms.html')

def privacy(request):
    return render(request, 'privacy.html')

from django.http import JsonResponse
from django.core.mail import send_mail
from django.conf import settings

def contact_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Send email
            send_mail(
                subject=f"Contact Form: {data['subject']}",
                message=f"From: {data['name']} ({data['email']})\n\nMessage:\n{data['message']}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.CONTACT_EMAIL],
                fail_silently=False,
            )
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    return render(request, 'contact.html')