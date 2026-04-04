import { useState, useEffect } from 'react';
import { shouldShowTestAds, getPositionConfig } from './config';

// Hook personalizado para gerenciar anúncios
export const useAdSense = (position = 'banner', options = {}) => {
  const [shouldShowAd, setShouldShowAd] = useState(false);
  const [adCount, setAdCount] = useState(0);

  useEffect(() => {
    // Verificar se deve mostrar anúncio nesta posição
    const positionEnabled = getPositionConfig(position);
    
    if (!positionEnabled) {
      setShouldShowAd(false);
      return;
    }

    // Verificar se deve mostrar anúncios de teste
    const showTest = shouldShowTestAds();
    
    // Verificar se o usuário não é admin (não mostrar anúncios para admins)
    const isAdmin = localStorage.getItem('userType') === 'admin';
    
    // Verificar se está em modo de desenvolvimento
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Decidir se deve mostrar o anúncio
    const showAd = showTest || (!isAdmin && !isDevelopment);
    
    setShouldShowAd(showAd);
  }, [position]);

  // Função para incrementar contador de anúncios
  const incrementAdCount = () => {
    setAdCount(prev => prev + 1);
  };

  // Função para verificar se deve mostrar anúncio baseado no intervalo
  const shouldShowAdByInterval = (interval = 3) => {
    return adCount % interval === 0;
  };

  // Função para obter tipo de anúncio baseado na posição
  const getAdType = (pos) => {
    switch (pos) {
      case 'header':
        return 'banner';
      case 'sidebar':
        return 'sidebar';
      case 'in-content':
        return 'in-content';
      case 'footer':
        return 'banner';
      case 'between-jobs':
        return 'responsive';
      case 'between-sections':
        return 'responsive';
      default:
        return 'banner';
    }
  };

  return {
    shouldShowAd,
    adCount,
    incrementAdCount,
    shouldShowAdByInterval,
    getAdType: () => getAdType(position),
    showTestAd: shouldShowTestAds()
  };
};

// Hook para gerenciar anúncios responsivos
export const useResponsiveAd = (position = 'banner') => {
  const [screenSize, setScreenSize] = useState('desktop');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    // Definir tamanho inicial
    handleResize();

    // Adicionar listener para mudanças de tamanho
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Obter tamanho do anúncio baseado no tamanho da tela
  const getAdSize = () => {
    const sizes = {
      mobile: {
        banner: '320x50',
        sidebar: '300x250',
        'in-content': '300x250'
      },
      tablet: {
        banner: '728x90',
        sidebar: '300x600',
        'in-content': '300x250'
      },
      desktop: {
        banner: '728x90',
        sidebar: '300x600',
        'in-content': '300x250'
      }
    };

    return sizes[screenSize]?.[position] || '728x90';
  };

  return {
    screenSize,
    getAdSize
  };
};

// Hook para gerenciar performance dos anúncios
export const useAdPerformance = () => {
  const [adLoadTimes, setAdLoadTimes] = useState({});
  const [adErrors, setAdErrors] = useState([]);

  // Registrar tempo de carregamento do anúncio
  const recordAdLoadTime = (adId, loadTime) => {
    setAdLoadTimes(prev => ({
      ...prev,
      [adId]: loadTime
    }));
  };

  // Registrar erro de anúncio
  const recordAdError = (adId, error) => {
    setAdErrors(prev => [...prev, { adId, error, timestamp: Date.now() }]);
  };

  // Obter estatísticas de performance
  const getPerformanceStats = () => {
    const loadTimes = Object.values(adLoadTimes);
    const avgLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length 
      : 0;

    return {
      totalAds: loadTimes.length,
      averageLoadTime: avgLoadTime,
      errorCount: adErrors.length,
      errors: adErrors
    };
  };

  return {
    recordAdLoadTime,
    recordAdError,
    getPerformanceStats
  };
}; 