export type SiteSectionId = 'featured' | 'arcade' | 'multiplayer' | 'academic-weapon' | 'casino';

export type PreviewType =
  | 'blackjack'
  | 'neon-snake'
  | 'space-runner'
  | 'punchy'
  | 'chess'
  | 'snake'
  | 'molar'
  | 'chairs'
  | 'ascension'
  | 'mole'
  | 'states'
  | 'tachymetry'
  | 'eight-ball';

export type GameCardData = {
  id: string;
  title: string;
  description: string;
  category: string;
  meta: string;
  preview: PreviewType;
  primarySection: SiteSectionId;
  sections: SiteSectionId[];
  internalPath?: string;
  externalUrl?: string;
  coverImage?: string;
};

export type SiteSection = {
  id: SiteSectionId;
  title: string;
  navLabel: string;
  path: string;
  description: string;
  comingSoon?: boolean;
};

export const siteSections: SiteSection[] = [
  {
    id: 'featured',
    title: 'Featured',
    navLabel: 'Featured',
    path: '/featured',
    description: 'Current highlights from the arcade, picked for quick starts and strong replay value.',
  },
  {
    id: 'arcade',
    title: 'Arcade',
    navLabel: 'Arcade',
    path: '/arcade',
    description: 'Fast single-player challenges, reflex games, score attacks, and bright arcade loops.',
  },
  {
    id: 'multiplayer',
    title: 'Multiplayer',
    navLabel: 'Multiplayer',
    path: '/multiplayer',
    description: 'Games with lobbies, real opponents, friend codes, or shared competitive play.',
  },
  {
    id: 'academic-weapon',
    title: 'Academic Weapon',
    navLabel: 'Academic Weapon',
    path: '/academic-weapon',
    description: 'Study-flavored games and quiz challenges for sharpening the useful parts of your brain.',
  },
  {
    id: 'casino',
    title: 'Casino',
    navLabel: 'Casino',
    path: '/casino',
    description: 'A future home for casino-inspired game design. No betting or gambling features are live here.',
    comingSoon: true,
  },
];

export const siteGames: GameCardData[] = [
  {
    id: 'blackjack-99',
    title: 'Blackjack 99',
    description: 'Survive a fast battle royale table where every hand can knock players out.',
    category: 'Cards',
    meta: 'Solo or online',
    preview: 'blackjack',
    primarySection: 'multiplayer',
    sections: ['featured', 'multiplayer'],
    internalPath: '/blackjack-99',
  },
  {
    id: 'neon-snake',
    title: 'Neon Snake',
    description: 'A glowing multiplayer snake arena for quick reflex duels.',
    category: 'Arcade',
    meta: 'External arena',
    preview: 'neon-snake',
    primarySection: 'multiplayer',
    sections: ['multiplayer'],
    externalUrl: 'https://multiplayer-neon-snake.onrender.com/',
  },
  {
    id: 'punchy',
    title: 'Punchy',
    description: 'A snappy fighting game with quick rounds and arcade action.',
    category: 'Action',
    meta: 'External game',
    preview: 'punchy',
    primarySection: 'featured',
    sections: ['featured', 'arcade'],
    externalUrl: 'https://fishfolk.github.io/punchy/player/latest/',
  },
  {
    id: 'the-ascension',
    title: 'The Ascension',
    description: 'A high-stakes 1v1 matchmaking game where facial metrics determine dominance.',
    category: 'Challenge',
    meta: 'Top 10 scores',
    preview: 'ascension',
    primarySection: 'featured',
    sections: ['featured', 'multiplayer'],
    internalPath: '/the-ascension',
  },
  {
    id: 'mole-mania',
    title: 'Mole Mania',
    description: 'A bright global whack-a-mole rush with bonus moles, penalties, and live rankings.',
    category: 'Arcade',
    meta: 'Global scores',
    preview: 'mole',
    primarySection: 'arcade',
    sections: ['featured', 'arcade'],
    internalPath: '/mole-mania',
  },
  {
    id: 'friend-chess',
    title: 'Friend Chess',
    description: 'Create lobby codes, play real-time chess, and review your match history.',
    category: 'Strategy',
    meta: '2 players',
    preview: 'chess',
    primarySection: 'multiplayer',
    sections: ['featured', 'multiplayer'],
    internalPath: '/friend-chess',
    coverImage: '/chess.png',
  },
  {
    id: 'snake-rush',
    title: 'Snake',
    description: 'High-speed snake with modes, board sizes, and online score chasing.',
    category: 'Arcade',
    meta: 'Leaderboard',
    preview: 'snake',
    primarySection: 'arcade',
    sections: ['arcade'],
    internalPath: '/snake-rush',
    coverImage: '/snake-rush.png',
  },
  {
    id: 'space-runner',
    title: 'Space Racer',
    description: 'Outrun an alien across glowing orbital lanes, dodging UFO fire and collecting star crystals.',
    category: 'Runner',
    meta: 'Top 10 scores',
    preview: 'space-runner',
    primarySection: 'arcade',
    sections: ['arcade'],
    internalPath: '/space-runner',
  },
  {
    id: 'molar-madness',
    title: 'Molar Madness',
    description: 'Dodge, chomp, and defend the enamel in a retro maze challenge.',
    category: 'Arcade',
    meta: 'Score attack',
    preview: 'molar',
    primarySection: 'arcade',
    sections: ['featured', 'arcade'],
    internalPath: '/molar-madness',
    coverImage: '/molar-madness.png',
  },
  {
    id: 'chairs-io',
    title: 'Chairs.io',
    description: 'Real-time musical chairs with private lobbies and tense eliminations.',
    category: 'Party',
    meta: '2-8 players',
    preview: 'chairs',
    primarySection: 'multiplayer',
    sections: ['multiplayer'],
    internalPath: '/chairs-io',
  },
  {
    id: 'eight-ball-arcade',
    title: '8 Ball Arcade',
    description: 'A polished pool table with local, bot, and online 8-ball matches.',
    category: 'Sports',
    meta: 'Local or online',
    preview: 'eight-ball',
    primarySection: 'multiplayer',
    sections: ['multiplayer'],
    internalPath: '/eight-ball-arcade',
  },
  {
    id: 'states-master',
    title: 'States Master',
    description: 'A fast US geography challenge where every state you name lights up the map.',
    category: 'Academic',
    meta: '50 states',
    preview: 'states',
    primarySection: 'academic-weapon',
    sections: ['academic-weapon'],
    internalPath: '/states-master',
  },
  {
    id: 'tachymetry',
    title: 'Tachymetry',
    description: 'A neon block-stacking arcade mission with hold pieces, combos, and global high scores.',
    category: 'Arcade',
    meta: 'Global scores',
    preview: 'tachymetry',
    primarySection: 'arcade',
    sections: ['arcade'],
    internalPath: '/tachymetry',
  },
];

export const homeGameSections = [
  {
    title: 'Featured Games',
    gameIds: ['blackjack-99', 'punchy', 'the-ascension', 'mole-mania'],
  },
  {
    title: 'Arcade Classics',
    gameIds: ['molar-madness', 'snake-rush', 'space-runner', 'tachymetry'],
  },
  {
    title: 'Multiplayer',
    gameIds: ['friend-chess', 'eight-ball-arcade', 'chairs-io', 'neon-snake'],
  },
  {
    title: 'Academic Weapon',
    gameIds: ['states-master'],
  },
];

export const gamesById = new Map(siteGames.map((game) => [game.id, game]));

export const getSectionGames = (gameIds: string[]) =>
  gameIds.reduce<GameCardData[]>((sectionGames, gameId) => {
    const game = gamesById.get(gameId);
    return game ? [...sectionGames, game] : sectionGames;
  }, []);

export const getGamesForSiteSection = (sectionId: SiteSectionId) =>
  sectionId === 'casino' ? [] : siteGames.filter((game) => game.sections.includes(sectionId));

export const getPrimarySectionForPath = (pathname: string): SiteSectionId | null => {
  if (pathname === '/neon-rush') {
    return 'arcade';
  }

  const matchingGame = siteGames.find((game) => game.internalPath === pathname);
  return matchingGame?.primarySection || null;
};
