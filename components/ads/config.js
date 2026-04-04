// Configuração do Google AdSense
export const ADSENSE_CONFIG = {
  // ID do Publicador (substitua pelo seu ID real)
  PUBLISHER_ID: 'ca-pub-YOUR_PUBLISHER_ID',
  
  // IDs dos slots de anúncios (substitua pelos seus IDs reais)
  AD_SLOTS: {
    BANNER: 'YOUR_BANNER_AD_SLOT',
    SIDEBAR: 'YOUR_SIDEBAR_AD_SLOT',
    IN_CONTENT: 'YOUR_INCONTENT_AD_SLOT',
    RESPONSIVE: 'YOUR_RESPONSIVE_AD_SLOT',
    HEADER: 'YOUR_HEADER_AD_SLOT',
    FOOTER: 'YOUR_FOOTER_AD_SLOT'
  },
  
  // Configurações de exibição
  DISPLAY: {
    // Mostrar anúncios de teste quando não há AdSense configurado
    SHOW_TEST_ADS: true,
    
    // Intervalo entre anúncios (em páginas)
    AD_INTERVAL: 3,
    
    // Posições onde mostrar anúncios
    POSITIONS: {
      HEADER: true,
      SIDEBAR: true,
      IN_CONTENT: true,
      FOOTER: true,
      BETWEEN_JOBS: true,
      BETWEEN_SECTIONS: true
    }
  },
  
  // Configurações de responsividade
  RESPONSIVE: {
    // Breakpoints para diferentes tamanhos de tela
    BREAKPOINTS: {
      MOBILE: 768,
      TABLET: 1024,
      DESKTOP: 1200
    },
    
    // Tamanhos de anúncios para diferentes dispositivos
    AD_SIZES: {
      MOBILE: {
        BANNER: '320x50',
        SIDEBAR: '300x250',
        IN_CONTENT: '300x250'
      },
      TABLET: {
        BANNER: '728x90',
        SIDEBAR: '300x600',
        IN_CONTENT: '300x250'
      },
      DESKTOP: {
        BANNER: '728x90',
        SIDEBAR: '300x600',
        IN_CONTENT: '300x250'
      }
    }
  }
};

// Função para verificar se o AdSense está configurado
export const isAdSenseConfigured = () => {
  return ADSENSE_CONFIG.PUBLISHER_ID !== 'ca-pub-YOUR_PUBLISHER_ID';
};

// Função para obter o ID do slot de anúncio
export const getAdSlot = (type) => {
  return ADSENSE_CONFIG.AD_SLOTS[type.toUpperCase()] || '';
};

// Função para obter o ID do publicador
export const getPublisherId = () => {
  return ADSENSE_CONFIG.PUBLISHER_ID;
};

// Função para verificar se deve mostrar anúncios de teste
export const shouldShowTestAds = () => {
  return ADSENSE_CONFIG.DISPLAY.SHOW_TEST_ADS && !isAdSenseConfigured();
};

// Função para obter configurações de posição
export const getPositionConfig = (position) => {
  return ADSENSE_CONFIG.DISPLAY.POSITIONS[position.toUpperCase()] || false;
}; 