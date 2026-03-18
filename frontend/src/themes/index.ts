export interface ThemeConfig {
  name: string;
  id: string;
  background: string;
  cardBg: string;
  textColor: string;
  buttonBg: string;
  buttonText: string;
  category: 'Link in bio' | 'Blog' | 'Shop';
}

export const themes: ThemeConfig[] = [
  {
    name: 'Basics',
    id: 'basics',
    background: '#1a1a1a',
    cardBg: '#2a2a2a',
    textColor: '#ffffff',
    buttonBg: '#333333',
    buttonText: '#ffffff',
    category: 'Link in bio',
  },
  {
    name: 'Carbon',
    id: 'carbon',
    background: '#0d0d0d',
    cardBg: '#1a1a1a',
    textColor: '#e0e0e0',
    buttonBg: '#252525',
    buttonText: '#ffffff',
    category: 'Link in bio',
  },
  {
    name: 'Christmas',
    id: 'christmas',
    background: '#1b4332',
    cardBg: '#2d6a4f',
    textColor: '#ffffff',
    buttonBg: '#c1121f',
    buttonText: '#ffffff',
    category: 'Link in bio',
  },
  {
    name: 'Pride',
    id: 'pride',
    background: 'linear-gradient(180deg, #FF0018 0%, #FFA52C 17%, #FFFF41 33%, #008018 50%, #0000F9 67%, #86007D 100%)',
    cardBg: 'rgba(255,255,255,0.2)',
    textColor: '#ffffff',
    buttonBg: 'rgba(255,255,255,0.25)',
    buttonText: '#ffffff',
    category: 'Link in bio',
  },
  {
    name: 'Glitch',
    id: 'glitch',
    background: '#0a0a0a',
    cardBg: '#111111',
    textColor: '#00ff41',
    buttonBg: '#1a1a1a',
    buttonText: '#00ff41',
    category: 'Link in bio',
  },
  {
    name: 'Winter Live',
    id: 'winter',
    background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
    cardBg: 'rgba(255,255,255,0.15)',
    textColor: '#ffffff',
    buttonBg: 'rgba(255,255,255,0.2)',
    buttonText: '#ffffff',
    category: 'Link in bio',
  },
  {
    name: 'Minimal',
    id: 'minimal',
    background: '#ffffff',
    cardBg: '#f5f5f5',
    textColor: '#1a1a1a',
    buttonBg: '#eeeeee',
    buttonText: '#1a1a1a',
    category: 'Blog',
  },
  {
    name: 'Ocean',
    id: 'ocean',
    background: 'linear-gradient(180deg, #0077b6 0%, #023e8a 100%)',
    cardBg: 'rgba(255,255,255,0.15)',
    textColor: '#ffffff',
    buttonBg: 'rgba(255,255,255,0.2)',
    buttonText: '#ffffff',
    category: 'Link in bio',
  },
  {
    name: 'Sunset',
    id: 'sunset',
    background: 'linear-gradient(180deg, #f72585 0%, #7209b7 50%, #3a0ca3 100%)',
    cardBg: 'rgba(255,255,255,0.15)',
    textColor: '#ffffff',
    buttonBg: 'rgba(255,255,255,0.2)',
    buttonText: '#ffffff',
    category: 'Shop',
  },
];

export function getTheme(id: string): ThemeConfig {
  return themes.find(t => t.id === id) || themes[0];
}
