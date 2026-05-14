export type DangerZone = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  riskLevel: 'alto' | 'medio' | 'baixo';
  coordinates: [number, number][][]; // GeoJSON Polygon
  center: [number, number]; // [longitude, latitude]
};

export const dangerZones: DangerZone[] = [
  {
    id: '1',
    name: 'Cidade de Deus',
    description: 'Área com histórico de conflitos armados entre facções e forças de segurança.',
    tags: ['Área de risco', 'Favela'],
    riskLevel: 'alto',
    center: [-43.3701, -22.9580],
    coordinates: [[
      [-43.3750, -22.9540],
      [-43.3650, -22.9540],
      [-43.3650, -22.9620],
      [-43.3750, -22.9620],
      [-43.3750, -22.9540],
    ]],
  },
  {
    id: '2',
    name: 'Rocinha',
    description: 'Maior favela do Brasil, com presença constante de grupos armados.',
    tags: ['Área de risco', 'Favela'],
    riskLevel: 'alto',
    center: [-43.2488, -22.9872],
    coordinates: [[
      [-43.2550, -22.9830],
      [-43.2430, -22.9830],
      [-43.2430, -22.9920],
      [-43.2550, -22.9920],
      [-43.2550, -22.9830],
    ]],
  },
  {
    id: '3',
    name: 'Complexo do Alemão',
    description: 'Complexo de favelas com histórico de conflitos e operações policiais frequentes.',
    tags: ['Área de risco', 'Favela', 'Complexo'],
    riskLevel: 'alto',
    center: [-43.2648, -22.8600],
    coordinates: [[
      [-43.2730, -22.8550],
      [-43.2560, -22.8550],
      [-43.2560, -22.8660],
      [-43.2730, -22.8660],
      [-43.2730, -22.8550],
    ]],
  },
];