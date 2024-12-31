$(document).ready(function() {
    // Cache DOM elements
    const videoUrlInput = $('#video-url');
    const pasteBtn = $('.paste-btn');
    const mainDownloadBtn = $('.download-btn');
    const downloadForm = $('#download-form');
    const urlValidation = $('#url-validation');
    const progressContainer = $('#progress-container');
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
            showMessage('Please enter a Facebook Reel URL', 'error');
            return;
        }

        if (!isValidReelUrl(url)) {
            showMessage('Please enter a valid Facebook Reel URL', 'error');
            return;
        }

        // Show loading spinner
        $('#progress-container').fadeIn(300);
        
        // Reset UI
        resetUI();
        videoContainer.hide();
        
        // Make AJAX request
        $.ajax({
            url: '/download-reel/',  // Using the reel-specific endpoint
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
                    }, 1000);
                } else {
                    showMessage(response.error || 'Failed to process reel', 'error');
                    $('#progress-container').fadeOut(300);
                }
            },
            error: function() {
                showMessage('An error occurred. Please try again.', 'error');
                $('#progress-container').fadeOut(300);
            }
        });
    });

    function setupDownloadButtons(response) {
        // SD Quality Button
        if (response.sd_url) {
            sdDownloadBtn
                .attr('href', response.sd_url)
                .attr('download', '')
                .attr('target', '_blank')
                .show();
        } else {
            sdDownloadBtn.hide();
        }
        
        // HD Quality Button
        if (response.hd_url) {
            hdDownloadBtn
                .attr('href', response.hd_url)
                .attr('download', '')
                .attr('target', '_blank')
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

    function updateVideoPreview(response) {
        const videoUrl = response.sd_url || response.hd_url;
        if (videoUrl) {
            videoPreview.attr('src', videoUrl);
            videoPreview[0].load();
        }
        
        $('#video-title').text(cleanTitle(response.title) || 'Facebook Reel');
        
        videoPreview.on('loadedmetadata', function() {
            const duration = this.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            $('#video-duration').text(
                `Duration: ${String(minutes).padStart(2, '0')} minutes, ${String(seconds).padStart(2, '0')} seconds`
            );
        });
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

        if (isValidReelUrl(url)) {
            urlValidation.html('<span class="text-success">Valid Facebook Reel URL</span>');
        } else {
            urlValidation.html('<span class="text-danger">Invalid Facebook Reel URL</span>');
        }
    }

    function isValidReelUrl(url) {
        return url.match(/^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/(reel|watch)/i);
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
});