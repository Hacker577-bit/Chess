export type OpeningMove = { from: string; to: string; san: string; idea: string };
export type Opening = { name: string; eco: string; side: 'white' | 'black' | 'any'; desc: string; moves: OpeningMove[] };

export const OPENINGS: Opening[] = [
  { name: 'Italian Game', eco: 'C50', side: 'white', desc: 'Fast development, eye on f7.',
    moves: [
      { from:'e2', to:'e4', san:'e4', idea:'Grabs the center' },
      { from:'e7', to:'e5', san:'e5', idea:'Black mirrors in the center' },
      { from:'g1', to:'f3', san:'Nf3', idea:'Develops & attacks e5' },
      { from:'b8', to:'c6', san:'Nc6', idea:'Defends the pawn' },
      { from:'f1', to:'c4', san:'Bc4', idea:'Targets the weak f7 square' }
    ]},
  { name: 'Ruy López', eco: 'C60', side: 'white', desc: 'Positional pressure on e5.',
    moves: [
      { from:'e2', to:'e4', san:'e4', idea:'Center' }, { from:'e7', to:'e5', san:'e5', idea:'Center' },
      { from:'g1', to:'f3', san:'Nf3', idea:'Develops' }, { from:'b8', to:'c6', san:'Nc6', idea:'Defends' },
      { from:'f1', to:'b5', san:'Bb5', idea:'Pins the c6 defender of e5' }
    ]},
  { name: 'London System', eco: 'D02', side: 'white', desc: 'Solid, system-based setup.',
    moves: [
      { from:'d2', to:'d4', san:'d4', idea:'Center pawn' }, { from:'g8', to:'f6', san:'Nf6', idea:'Flexible development' },
      { from:'c1', to:'f4', san:'Bf4', idea:'Develops the bishop outside the chain' },
      { from:'d7', to:'d5', san:'d5', idea:'Black claims the center' },
      { from:'g1', to:'f3', san:'Nf3', idea:'Controls e5' }, { from:'e7', to:'e6', san:'e6', idea:'Solidifies' },
      { from:'e2', to:'e3', san:'e3', idea:'Pyramid structure' }
    ]},
  { name: "Queen's Gambit", eco: 'D06', side: 'white', desc: 'Center tension from move two.',
    moves: [
      { from:'d2', to:'d4', san:'d4', idea:'Center' }, { from:'d7', to:'d5', san:'d5', idea:'Symmetry' },
      { from:'c2', to:'c4', san:'c4', idea:'Challenges d5' }, { from:'e7', to:'e6', san:'e6', idea:'Declines, holds d5' },
      { from:'b1', to:'c3', san:'Nc3', idea:'Develops & pressures d5' }
    ]},
  { name: 'French Defense', eco: 'C00', side: 'black', desc: 'Solid, counter-attacking structure.',
    moves: [
      { from:'e2', to:'e4', san:'e4', idea:'White opens' }, { from:'e7', to:'e6', san:'e6', idea:'French: prepares d5' },
      { from:'d2', to:'d4', san:'d4', idea:'White builds center' }, { from:'d7', to:'d5', san:'d5', idea:'Strikes the center' },
      { from:'b1', to:'c3', san:'Nc3', idea:'Defends e4' }, { from:'g8', to:'f6', san:'Nf6', idea:'Pressures e4 again' }
    ]},
  { name: 'Sicilian Defense', eco: 'B20', side: 'black', desc: 'Asymmetrical, winning chances.',
    moves: [
      { from:'e2', to:'e4', san:'e4', idea:'White opens' }, { from:'c7', to:'c5', san:'c5', idea:'Sicilian: fights d4' },
      { from:'g1', to:'f3', san:'Nf3', idea:'Develops' }, { from:'d7', to:'d6', san:'d6', idea:'Controls e5' },
      { from:'d2', to:'d4', san:'d4', idea:'Open Sicilian' }, { from:'c5', to:'d4', san:'cxd4', idea:'Trades a flank pawn for a center pawn' }
    ]},
  { name: 'Caro-Kann', eco: 'B10', side: 'black', desc: 'Rock-solid pawn structure.',
    moves: [
      { from:'e2', to:'e4', san:'e4', idea:'White opens' }, { from:'c7', to:'c6', san:'c6', idea:'Prepares d5 without blocking the bishop' },
      { from:'d2', to:'d4', san:'d4', idea:'Center' }, { from:'d7', to:'d5', san:'d5', idea:'Challenges e4' }
    ]},
  { name: "King's Indian Defense", eco: 'E60', side: 'black', desc: 'Hypermodern, kingside attack.',
    moves: [
      { from:'d2', to:'d4', san:'d4', idea:'Center' }, { from:'g8', to:'f6', san:'Nf6', idea:'Flexible' },
      { from:'c2', to:'c4', san:'c4', idea:'Space' }, { from:'g7', to:'g6', san:'g6', idea:'Fianchetto' },
      { from:'b1', to:'c3', san:'Nc3', idea:'Develops' }, { from:'f8', to:'g7', san:'Bg7', idea:'Bishop eyes the center' }
    ]},
  { name: 'Scandinavian', eco: 'B01', side: 'black', desc: 'Immediate central counter.',
    moves: [
      { from:'e2', to:'e4', san:'e4', idea:'White opens' }, { from:'d7', to:'d5', san:'d5', idea:'Strikes immediately' },
      { from:'e4', to:'d5', san:'exd5', idea:'Accepts' }, { from:'d8', to:'d5', san:'Qxd5', idea:'Queen recaptures' },
      { from:'b1', to:'c3', san:'Nc3', idea:'Develops with tempo' }
    ]}
];