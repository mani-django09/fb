$(document).ready(function() {
    // Cache DOM elements
    const videoUrlInput = $('#video-url');
    const pasteBtn = $('.paste-btn');
    const mainDownloadBtn = $('.download-btn');
    const downloadForm = $('#download-form');
    const urlValidation = $('#url-validation');
    const progressContainer = $('#progress-container');
    const progressBar = $('#progress-bar');
    const videoContainer = $('#video-container');
    const videoPreview = $('#video-preview');
    const sdDownloadBtn = $('#sd-download');
    const hdDownloadBtn = $('#hd-download');

    // Handle paste button
    pasteBtn.on('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            videoUrlInput.val(text);
            validateUrl(text);
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            showMessage('Failed to paste from clipboard', 'error');
        }
    });

    // URL validation on input
    videoUrlInput.on('input', function() {
        validateUrl($(this).val());
    });

    // Form submission
    downloadForm.on('submit', function(e) {
        e.preventDefault();
        
        const url = videoUrlInput.val().trim();
        
        if (!url) {
            showMessage('Please enter a Facebook video URL', 'error');
            return;
        }
    
        if (!isValidFacebookUrl(url)) {
            showMessage('Please enter a valid Facebook video URL', 'error');
            return;
        }
    
        // Show loading spinner
        $('#progress-container').fadeIn(300);
        
        // Reset UI
        resetUI();
        videoContainer.hide();
        
        // Make AJAX request
        $.ajax({
            url: '/download/',
            method: 'POST',
            data: JSON.stringify({ url: url }),
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                if (response.success) {
                    setTimeout(() => {
                        $('#progress-container').fadeOut(300, function() {
                            updateVideoPreview(response);
                            setupDownloadButtons(response);
                            videoContainer.fadeIn(500);
                        });
                    }, 1000); // Show spinner for at least 1 second
                } else {
                    showMessage(response.error || 'Failed to process video', 'error');
                    $('#progress-container').fadeOut(300);
                }
            },
            error: function() {
                showMessage('An error occurred. Please try again.', 'error');
                $('#progress-container').fadeOut(300);
            }
        });
    });
    // Set up download buttons with direct download links
    function setupDownloadButtons(response) {
        // SD Quality Button
        if (response.sd_url) {
            sdDownloadBtn
                .attr('href', response.sd_url)
                .attr('download', '')  // Enable download attribute
                .attr('target', '_blank')  // Open in new tab as fallback
                .show();
        } else {
            sdDownloadBtn.hide();
        }
        
        // HD Quality Button
        if (response.hd_url) {
            hdDownloadBtn
                .attr('href', response.hd_url)
                .attr('download', '')  // Enable download attribute
                .attr('target', '_blank')  // Open in new tab as fallback
                .show();
        } else {
            hdDownloadBtn.hide();
        }

        // Add click handlers for download buttons
        sdDownloadBtn.off('click').on('click', function(e) {
            startDownload(response.sd_url, 'sd');
        });

        hdDownloadBtn.off('click').on('click', function(e) {
            startDownload(response.hd_url, 'hd');
        });
    }

    // Handle the actual download
    function startDownload(url, quality) {
        if (!url) return;

        // Show loading state for the clicked button
        const button = quality === 'sd' ? sdDownloadBtn : hdDownloadBtn;
        button.addClass('loading');

        // Create and trigger download
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = `facebook-video-${quality}.mp4`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
            })
            .catch(error => {
                console.error('Download failed:', error);
                // Fallback to opening in new tab
                window.open(url, '_blank');
            })
            .finally(() => {
                button.removeClass('loading');
            });
    }

    // Update video preview and info
    function updateVideoPreview(response) {
        const videoUrl = response.sd_url || response.hd_url;
        if (videoUrl) {
            videoPreview.attr('src', videoUrl);
            videoPreview[0].load(); // Force video reload
        }
        
        // Clean and set the title
        const cleanedTitle = cleanTitle(response.title) || 'No video title';
        $('#video-title').text(cleanedTitle);
        
        // Update description and duration
        $('#video-description').text('Description: ' + (response.description || 'No video description...'));
        
        // Handle video metadata
        videoPreview.on('loadedmetadata', function() {
            const duration = this.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            $('#video-duration').text(
                `Duration: ${String(minutes).padStart(2, '0')} minutes, ${String(seconds).padStart(2, '0')} seconds`
            );
        });
    }
    // Helper Functions
    function showLoadingState() {
        mainDownloadBtn.prop('disabled', true);
    }

    function hideLoadingState() {
        mainDownloadBtn.prop('disabled', false);
    }

    function resetUI() {
        videoContainer.hide();
        $('.message').remove();
    }

    function validateUrl(url) {
        if (!url) {
            urlValidation.html('');
            return;
        }

        if (isValidFacebookUrl(url)) {
            urlValidation.html('<span class="text-success">Valid Facebook URL</span>');
        } else {
            urlValidation.html('<span class="text-danger">Invalid Facebook URL</span>');
        }
    }

    function isValidFacebookUrl(url) {
        return url.match(/^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)/i);
    }

    function showMessage(message, type) {
        const messageElement = $('<div>')
            .text(message)
            .addClass(`message ${type}`);
        
        downloadForm.append(messageElement);

        setTimeout(() => {
            messageElement.fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    

function cleanTitle(title) {
    // Remove HTML entities and additional text patterns
    return title
        .replace(/&.+?;/g, '') // Remove HTML entities
        .replace(/\d+M views/g, '') // Remove view counts
        .replace(/\d+(\.\d+)?M likes/g, '') // Remove like counts
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim(); // Remove leading/trailing whitespace
}

// Single FAQ handler
$('.faq-item h3').click(function() {
    const faqItem = $(this).parent();
    const answer = faqItem.find('.faq-answer');
    
    if (faqItem.hasClass('active')) {
        faqItem.removeClass('active');
        setTimeout(() => {
            answer.hide();
        }, 300);
    } else {
        $('.faq-item.active').removeClass('active').find('.faq-answer').hide();
        faqItem.addClass('active');
        answer.show();
    }
});
});

