# downloader/translations.py

TRANSLATIONS = {
    'en': {
        'facebook_downloader': 'Facebook Video Downloader',
        'download_reels': 'Download Facebook Reels',
        'enter_url': 'Enter video URL',
        'download': 'Download',
        'processing': 'Processing...',
        # Add more translations
    },
    'es': {
        'facebook_downloader': 'Descargador de Videos de Facebook',
        'download_reels': 'Descargar Reels de Facebook',
        'enter_url': 'Ingrese la URL del video',
        'download': 'Descargar',
        'processing': 'Procesando...',
    },
    'fr': {
        'facebook_downloader': 'Téléchargeur de Vidéos Facebook',
        'download_reels': 'Télécharger les Reels Facebook',
        'enter_url': 'Entrez l\'URL de la vidéo',
        'download': 'Télécharger',
        'processing': 'Traitement en cours...',
    },
    'it': {
        'facebook_downloader': 'Scarica Video da Facebook',
        'download_reels': 'Scarica Reels da Facebook',
        'enter_url': 'Inserisci l\'URL del video',
        'download': 'Scarica',
        'processing': 'Elaborazione...',
    },
    'pt': {
        'facebook_downloader': 'Download de Vídeos do Facebook',
        'download_reels': 'Baixar Reels do Facebook',
        'enter_url': 'Insira a URL do vídeo',
        'download': 'Baixar',
        'processing': 'Processando...',
    },
    'hi': {
        'facebook_downloader': 'फेसबुक वीडियो डाउनलोडर',
        'download_reels': 'फेसबुक रील्स डाउनलोड करें',
        'enter_url': 'वीडियो URL दर्ज करें',
        'download': 'डाउनलोड करें',
        'processing': 'प्रोसेसिंग...',
    }
}

def get_translation(key, lang='en'):
    return TRANSLATIONS.get(lang, TRANSLATIONS['en']).get(key, TRANSLATIONS['en'].get(key, key))