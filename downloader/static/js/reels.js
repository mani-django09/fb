$(document).ready(function() {
    // Cache DOM elements
    const videoUrlInput = $('#video-url');
    const pasteBtn = $('.paste-btn');
    const downloadForm = $('#download-form');
    const urlValidation = $('#url-validation');
    const progressContainer = $('#progress-container');
    const videoContainer = $('#video-container');
    const videoPreview = $('#video-preview');
    const videoTitle = $('#video-title');
    const videoDuration = $('#video-duration');
    const videoDescription = $('#video-description');
    const sdDownloadBtn = $('#sd-download');
    const hdDownloadBtn = $('#hd-download');

    // Handle paste button click
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

    // Validate URL on input
    videoUrlInput.on('input', function() {
        validateUrl($(this).val().trim());
    });

    // Form submission
    downloadForm.on('submit', function(e) {
        e.preventDefault();
        
        const url = videoUrlInput.val().trim();
        
        console.log('Submitting URL:', url); // Debugging line

        if (!url) {
            showMessage('Please enter a Facebook Reel URL', 'error');
            return;
        }

        if (!isValidReelUrl(url)) {
            showMessage('Invalid Facebook Reel URL', 'error');
            return;
        }

        // Show loading spinner
        progressContainer.fadeIn(300);
        
        // Reset UI
        resetUI();
        
        // Make AJAX request
        $.ajax({
            url: '/download-reel/',
            method: 'POST',
            data: JSON.stringify({ url: url }),
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                progressContainer.fadeOut(300, function() {
                    if (response.success) {
                        updateVideoPreview(response);
                        setupDownloadButtons(response);
                        videoContainer.fadeIn(500);
                    } else {
                        showMessage(response.error || 'Failed to process reel', 'error');
                    }
                });
            },
            error: function(xhr, status, error) {
                progressContainer.fadeOut(300, function() {
                    console.error('AJAX Error:', status, error);
                    showMessage('An error occurred. Please try again.', 'error');
                });
            }
        });
    });

    function isValidReelUrl(url) {
        // This regex is more permissive, allowing various Facebook URL formats
        const facebookUrlRegex = /^(https?:\/\/)?(www\.)?(facebook|fb)\.(com|watch)\/.+/i;
        return facebookUrlRegex.test(url);
    }

    function validateUrl(url) {
        if (!url) {
            urlValidation.html('');
            return;
        }

        if (isValidReelUrl(url)) {
            urlValidation.html('<span class="text-success">Valid Facebook URL</span>');
        } else {
            urlValidation.html('<span class="text-danger">Invalid Facebook URL</span>');
        }
    }

    function updateVideoPreview(response) {
        const videoUrl = response.sd_url || response.hd_url;
        if (videoUrl) {
            videoPreview.attr('src', videoUrl);
            videoPreview[0].load();
        }
        
        videoTitle.text(cleanTitle(response.title) || 'Facebook Reel');
        videoDescription.text(response.description || 'No description available.');
        
        videoPreview.on('loadedmetadata', function() {
            const duration = this.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            videoDuration.text(
                `Duration: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            );
        });
    }

    function setupDownloadButtons(response) {
        if (response.sd_url) {
            sdDownloadBtn.attr('href', response.sd_url).show();
        } else {
            sdDownloadBtn.hide();
        }
        
        if (response.hd_url) {
            hdDownloadBtn.attr('href', response.hd_url).show();
        } else {
            hdDownloadBtn.hide();
        }

        sdDownloadBtn.off('click').on('click', function(e) {
            e.preventDefault();
            startDownload(response.sd_url, 'sd');
        });

        hdDownloadBtn.off('click').on('click', function(e) {
            e.preventDefault();
            startDownload(response.hd_url, 'hd');
        });
    }

    function startDownload(url, quality) {
        if (!url) return;

        const button = quality === 'sd' ? sdDownloadBtn : hdDownloadBtn;
        button.addClass('loading');

        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = blobUrl;
                a.download = `facebook-reel-${quality}.mp4`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
            })
            .catch(error => {
                console.error('Download failed:', error);
                window.open(url, '_blank');
            })
            .finally(() => {
                button.removeClass('loading');
            });
    }

    function resetUI() {
        videoContainer.hide();
        $('.message').remove();
    }

    function cleanTitle(title) {
        return (title || '')
            .replace(/&.+?;/g, '')
            .replace(/\d+M views/g, '')
            .replace(/\d+(\.\d+)?M likes/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function showMessage(message, type) {
        $('.message').remove(); // Remove any existing messages
        const messageElement = $('<div>')
            .text(message)
            .addClass(`message ${type}`);
        
        downloadForm.after(messageElement);

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
});

