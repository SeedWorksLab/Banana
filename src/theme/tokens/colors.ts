export interface SurfaceColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceSecondary: string;
  readonly surfaceTertiary: string;
  readonly surfaceHover: string;
  readonly surfacePressed: string;
  readonly elevation1: string;
  readonly elevation2: string;
  readonly elevation3: string;
  readonly elevation4: string;
  readonly elevation5: string;
}

export interface BorderColors {
  readonly border: string;
  readonly borderStrong: string;
  readonly borderSubtle: string;
}

export interface TextColors {
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly disabled: string;
  readonly onAccent: string;
}

export interface BrandScale {
  readonly base: string;
  readonly hover: string;
  readonly pressed: string;
  readonly light: string;
  readonly muted: string;
}

export interface SemanticTokens {
  readonly success: string;
  readonly successLight: string;
  readonly successBorder: string;
  readonly warning: string;
  readonly warningLight: string;
  readonly warningBorder: string;
  readonly error: string;
  readonly errorLight: string;
  readonly errorBorder: string;
  readonly onErrorContainer: string;
  readonly info: string;
  readonly infoLight: string;
  readonly infoBorder: string;
}

export interface ColorTokens {
  readonly surfaces: SurfaceColors;
  readonly borders: BorderColors;
  readonly text: TextColors;
  readonly primary: BrandScale;
  readonly secondary: BrandScale;
  readonly water: BrandScale;
  readonly warm: BrandScale;
  readonly semantic: SemanticTokens;
}

export const lightColors: ColorTokens = {
  surfaces: {
    background: '#F7F4E7',
    surface: '#FDFBF2',
    surfaceSecondary: '#EEEAD8',
    surfaceTertiary: '#E4DEC6',
    surfaceHover: '#F3F0DF',
    surfacePressed: '#DED7BB',
    elevation1: '#FBF9EE',
    elevation2: '#F7F4E7',
    elevation3: '#F3EFDD',
    elevation4: '#EFEBD3',
    elevation5: '#EBE6C9',
  },
  borders: {
    border: '#DFD8BE',
    borderStrong: '#C7BE9C',
    borderSubtle: '#EBE6D2',
  },
  text: {
    primary: '#26241A',
    secondary: '#56524A',
    tertiary: '#77735F',
    disabled: '#A6A08C',
    onAccent: '#FFFDF9',
  },
  primary: {
    base: '#6E5406',
    hover: '#614B05',
    pressed: '#544003',
    light: '#F2EBCB',
    muted: '#CDBC84',
  },
  secondary: {
    base: '#3F6B34',
    hover: '#365E2C',
    pressed: '#2D5025',
    light: '#E2EBD8',
    muted: '#B9CCA8',
  },
  water: {
    base: '#2C6A66',
    hover: '#265D59',
    pressed: '#214F4C',
    light: '#DCEBE6',
    muted: '#AECCC5',
  },
  warm: {
    base: '#8A4F16',
    hover: '#794513',
    pressed: '#693B10',
    light: '#F0E3D3',
    muted: '#D9BF9A',
  },
  semantic: {
    success: '#4F7A34',
    successLight: '#E4EBD8',
    successBorder: '#C2D2A8',
    warning: '#8A5A16',
    warningLight: '#F1E4CE',
    warningBorder: '#DCC196',
    error: '#A8323A',
    errorLight: '#F3DEDE',
    errorBorder: '#E5BEBD',
    onErrorContainer: '#6E1B22',
    info: '#3F6E86',
    infoLight: '#E6EBEC',
    infoBorder: '#C0CFD5',
  },
};

export const darkColors: ColorTokens = {
  surfaces: {
    background: '#0F0F0A',
    surface: '#15150F',
    surfaceSecondary: '#1D1D14',
    surfaceTertiary: '#262518',
    surfaceHover: '#22211A',
    surfacePressed: '#2C2A1D',
    elevation1: '#17160F',
    elevation2: '#1A1911',
    elevation3: '#1D1C13',
    elevation4: '#201F16',
    elevation5: '#242218',
  },
  borders: {
    border: '#33301F',
    borderStrong: '#47432C',
    borderSubtle: '#2A2818',
  },
  text: {
    primary: '#F5F2E4',
    secondary: '#C9C4B2',
    tertiary: '#9E9A87',
    disabled: '#6B675A',
    onAccent: '#15150F',
  },
  primary: {
    base: '#E0C24B',
    hover: '#E5CB63',
    pressed: '#E1C550',
    light: '#3A3013',
    muted: '#5F5220',
  },
  secondary: {
    base: '#8FC77E',
    hover: '#9CCE8C',
    pressed: '#92C981',
    light: '#26301F',
    muted: '#3C4E30',
  },
  water: {
    base: '#7FC4BC',
    hover: '#8FCBC4',
    pressed: '#82C6BE',
    light: '#20302E',
    muted: '#35524D',
  },
  warm: {
    base: '#E0A45C',
    hover: '#E4B074',
    pressed: '#E1A760',
    light: '#3A2B19',
    muted: '#5E4527',
  },
  semantic: {
    success: '#7DBE6A',
    successLight: '#232D1E',
    successBorder: '#3B5234',
    warning: '#E0A45C',
    warningLight: '#362A1C',
    warningBorder: '#65502E',
    error: '#E2817D',
    errorLight: '#362420',
    errorBorder: '#6A3D38',
    onErrorContainer: '#F6BDB8',
    info: '#8BBEDA',
    infoLight: '#2A2D2E',
    infoBorder: '#3F5866',
  },
};
