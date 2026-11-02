export type Lang = 'en' | 'hi';

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    tagline: 'Your Health. Your Nutrition. Your Personalized Plate.',
    marketplace: 'Marketplace',
    howItWorks: 'How It Works',
    dietitians: 'Dietitians',
    pricing: 'Pricing',
    about: 'About',
    signIn: 'Sign In',
    dashboard: 'Open Portal',
    exploreMeals: 'Explore Verified Meals',
    bookDietitian: 'Consult a Registered Dietitian',
    cart: 'Cart',
    logout: 'Sign Out',
  },
  hi: {
    tagline: 'आपका स्वास्थ्य। आपका पोषण। आपकी व्यक्तिगत थाली।',
    marketplace: 'आहार बाज़ार',
    howItWorks: 'कैसे काम करता है',
    dietitians: 'आहार विशेषज्ञ',
    pricing: 'सदस्यता शुल्क',
    about: 'हमारे बारे में',
    signIn: 'लॉग इन',
    dashboard: 'डैशबोर्ड खोलें',
    exploreMeals: 'प्रमाणित भोजन देखें',
    bookDietitian: 'आहार विशेषज्ञ से परामर्श लें',
    cart: 'कार्ट',
    logout: 'लॉग आउट',
  },
};
