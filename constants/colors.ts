
const gold = '#D4AF37'; // Classic Gold
const darkNavy = '#0A192F'; // Deep Navy
const darkNavyLight = '#112240'; // Lighter Navy for cards
const white = '#FFFFFF';
const lightGray = '#E6E6E6';
const error = '#FF4D4D';
const success = '#4CAF50';

export const Colors = {
  light: {
    primary: gold,
    background: white, // Used for contrast if needed, but main theme is dark
    text: darkNavy,
    tint: gold,
    icon: darkNavy,
    tabIconDefault: '#ccc',
    tabIconSelected: gold,
  },
  dark: {
    primary: gold,
    background: darkNavy,
    card: darkNavyLight,
    text: white,
    textSecondary: '#8892b0',
    border: '#233554',
    tint: gold,
    icon: gold,
    tabIconDefault: '#8892b0',
    tabIconSelected: gold,
    error,
    success,
  },
};

export default Colors.dark; // Defaulting to dark theme for the Royal look
