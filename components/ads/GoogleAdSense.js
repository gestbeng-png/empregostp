import { useEffect } from 'react';

// Componente para carregar o script do Google AdSense
const GoogleAdSenseScript = () => {
  useEffect(() => {
    // Verificar se o script já foi carregado
    if (window.adsbygoogle) {
      return;
    }

    // Carregar o script do Google AdSense
    const script = document.createElement('script');
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_PUBLISHER_ID';
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    return () => {
      // Limpar o script quando o componente for desmontado
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return null;
};

// Componente para anúncio banner horizontal
export const BannerAd = ({ className = '', style = {} }) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('Erro ao carregar anúncio banner:', error);
    }
  }, []);

  return (
    <div className={`ads-banner ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
        data-ad-slot="YOUR_BANNER_AD_SLOT"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

// Componente para anúncio lateral (sidebar)
export const SidebarAd = ({ className = '', style = {} }) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('Erro ao carregar anúncio sidebar:', error);
    }
  }, []);

  return (
    <div className={`ads-sidebar ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
        data-ad-slot="YOUR_SIDEBAR_AD_SLOT"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

// Componente para anúncio entre conteúdo
export const InContentAd = ({ className = '', style = {} }) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('Erro ao carregar anúncio in-content:', error);
    }
  }, []);

  return (
    <div className={`ads-in-content ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
        data-ad-slot="YOUR_INCONTENT_AD_SLOT"
      />
    </div>
  );
};

// Componente para anúncio responsivo
export const ResponsiveAd = ({ className = '', style = {} }) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('Erro ao carregar anúncio responsivo:', error);
    }
  }, []);

  return (
    <div className={`ads-responsive ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
        data-ad-slot="YOUR_RESPONSIVE_AD_SLOT"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

// Componente para anúncio de teste (quando não há AdSense configurado)
export const TestAd = ({ className = '', style = {} }) => {
  return (
    <div 
      className={`ads-test ${className}`} 
      style={{
        background: '#f0f0f0',
        border: '2px dashed #ccc',
        padding: '20px',
        textAlign: 'center',
        margin: '20px 0',
        borderRadius: '8px',
        ...style
      }}
    >
      <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
        📢 Espaço para Anúncio
      </p>
      <p style={{ margin: '5px 0 0 0', color: '#999', fontSize: '12px' }}>
        Configure o Google AdSense para exibir anúncios aqui
      </p>
    </div>
  );
};

// Componente wrapper que carrega o script e renderiza o anúncio
export const GoogleAdSense = ({ 
  type = 'banner', 
  className = '', 
  style = {},
  showTestAd = false 
}) => {
  // Se showTestAd for true, mostra anúncio de teste
  if (showTestAd) {
    return <TestAd className={className} style={style} />;
  }

  // Renderiza o script do AdSense
  GoogleAdSenseScript();

  // Renderiza o tipo de anúncio apropriado
  switch (type) {
    case 'banner':
      return <BannerAd className={className} style={style} />;
    case 'sidebar':
      return <SidebarAd className={className} style={style} />;
    case 'in-content':
      return <InContentAd className={className} style={style} />;
    case 'responsive':
      return <ResponsiveAd className={className} style={style} />;
    default:
      return <BannerAd className={className} style={style} />;
  }
};

export default GoogleAdSense; 