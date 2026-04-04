import React from 'react';
import GoogleAdSense from './GoogleAdSense';
import { useAdSense } from './useAdSense';

// Componente wrapper para anúncio no header
export const HeaderAd = ({ className = '', style = {} }) => {
  const { shouldShowAd, showTestAd } = useAdSense('header');

  if (!shouldShowAd) return null;

  return (
    <div className={`header-ad ${className}`} style={style}>
      <GoogleAdSense 
        type="banner" 
        showTestAd={showTestAd}
        style={{ 
          margin: '10px 0',
          textAlign: 'center',
          ...style 
        }}
      />
    </div>
  );
};

// Componente wrapper para anúncio na sidebar
export const SidebarAdWrapper = ({ className = '', style = {} }) => {
  const { shouldShowAd, showTestAd } = useAdSense('sidebar');

  if (!shouldShowAd) return null;

  return (
    <div className={`sidebar-ad ${className}`} style={style}>
      <GoogleAdSense 
        type="sidebar" 
        showTestAd={showTestAd}
        style={{ 
          margin: '20px 0',
          textAlign: 'center',
          ...style 
        }}
      />
    </div>
  );
};

// Componente wrapper para anúncio entre conteúdo
export const InContentAdWrapper = ({ className = '', style = {} }) => {
  const { shouldShowAd, showTestAd } = useAdSense('in-content');

  if (!shouldShowAd) return null;

  return (
    <div className={`in-content-ad ${className}`} style={style}>
      <GoogleAdSense 
        type="in-content" 
        showTestAd={showTestAd}
        style={{ 
          margin: '30px 0',
          textAlign: 'center',
          ...style 
        }}
      />
    </div>
  );
};

// Componente wrapper para anúncio no footer
export const FooterAd = ({ className = '', style = {} }) => {
  const { shouldShowAd, showTestAd } = useAdSense('footer');

  if (!shouldShowAd) return null;

  return (
    <div className={`footer-ad ${className}`} style={style}>
      <GoogleAdSense 
        type="banner" 
        showTestAd={showTestAd}
        style={{ 
          margin: '20px 0',
          textAlign: 'center',
          ...style 
        }}
      />
    </div>
  );
};

// Componente wrapper para anúncio entre vagas
export const BetweenJobsAd = ({ className = '', style = {} }) => {
  const { shouldShowAd, showTestAd, shouldShowAdByInterval } = useAdSense('between-jobs');

  if (!shouldShowAd || !shouldShowAdByInterval(3)) return null;

  return (
    <div className={`between-jobs-ad ${className}`} style={style}>
      <GoogleAdSense 
        type="responsive" 
        showTestAd={showTestAd}
        style={{ 
          margin: '30px 0',
          textAlign: 'center',
          ...style 
        }}
      />
    </div>
  );
};

// Componente wrapper para anúncio entre seções
export const BetweenSectionsAd = ({ className = '', style = {} }) => {
  const { shouldShowAd, showTestAd, shouldShowAdByInterval } = useAdSense('between-sections');

  if (!shouldShowAd || !shouldShowAdByInterval(2)) return null;

  return (
    <div className={`between-sections-ad ${className}`} style={style}>
      <GoogleAdSense 
        type="responsive" 
        showTestAd={showTestAd}
        style={{ 
          margin: '40px 0',
          textAlign: 'center',
          ...style 
        }}
      />
    </div>
  );
};

// Componente wrapper genérico
export const AdWrapper = ({ 
  position = 'banner', 
  className = '', 
  style = {},
  children 
}) => {
  const { shouldShowAd, showTestAd, getAdType } = useAdSense(position);

  if (!shouldShowAd) return null;

  return (
    <div className={`ad-wrapper ad-${position} ${className}`} style={style}>
      <GoogleAdSense 
        type={getAdType()} 
        showTestAd={showTestAd}
        style={{ 
          margin: '20px 0',
          textAlign: 'center',
          ...style 
        }}
      />
      {children}
    </div>
  );
};

// Componente para anúncio condicional baseado em props
export const ConditionalAd = ({ 
  condition = true,
  position = 'banner',
  className = '',
  style = {},
  fallback = null
}) => {
  const { shouldShowAd, showTestAd, getAdType } = useAdSense(position);

  if (!condition || !shouldShowAd) {
    return fallback;
  }

  return (
    <div className={`conditional-ad ${className}`} style={style}>
      <GoogleAdSense 
        type={getAdType()} 
        showTestAd={showTestAd}
        style={{ 
          margin: '20px 0',
          textAlign: 'center',
          ...style 
        }}
      />
    </div>
  );
}; 