// Exportações principais
export { default as GoogleAdSense } from './GoogleAdSense';
export { BannerAd, SidebarAd, InContentAd, ResponsiveAd, TestAd } from './GoogleAdSense';

// Exportações dos wrappers
export {
  HeaderAd,
  SidebarAdWrapper,
  InContentAdWrapper,
  FooterAd,
  BetweenJobsAd,
  BetweenSectionsAd,
  AdWrapper,
  ConditionalAd
} from './AdWrapper';

// Exportações dos hooks
export {
  useAdSense,
  useResponsiveAd,
  useAdPerformance
} from './useAdSense';

// Exportações da configuração
export {
  ADSENSE_CONFIG,
  isAdSenseConfigured,
  getAdSlot,
  getPublisherId,
  shouldShowTestAds,
  getPositionConfig
} from './config';

// Exportação padrão
export { default } from './GoogleAdSense'; 