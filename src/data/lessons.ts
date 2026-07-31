export type Step = { from: string; to: string; caption: string; promotion?: string };
export type Lesson = { id: string; title: string; desc: string; fen: string; steps: Step[] };

export const LEARN: Lesson[] = [
  { id:'center', title:'Control the Center', desc:'Pawns on e4/d4 give your pieces room.',
    fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    steps:[
      { from:'e2', to:'e4', caption:'e4 — grabs the center & opens the bishop' },
      { from:'e7', to:'e5', caption:'e5 — Black answers symmetrically' },
      { from:'g1', to:'f3', caption:'Nf3 — develops AND attacks e5' },
      { from:'b8', to:'c6', caption:'Nc6 — develops & defends' }
    ]},
  { id:'develop', title:'Develop Before You Attack', desc:'Knights & bishops first, queen later.',
    fen:'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    steps:[
      { from:'e7', to:'e5', caption:'Claim space' },
      { from:'g1', to:'f3', caption:'Knight out with purpose' },
      { from:'b8', to:'c6', caption:'Mirror development' },
      { from:'f1', to:'c4', caption:'Bishop to an active diagonal' }
    ]},
  { id:'castle', title:'Castle Early', desc:'Tuck the king away & connect the rooks.',
    fen:'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    steps:[
      { from:'e1', to:'g1', caption:'O-O — king safe, rook activated' }
    ]},
  { id:'fork', title:'The Fork', desc:'One piece attacks two targets at once.',
    fen:'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1',
    steps:[
      { from:'f3', to:'e5', caption:'Nxe5! wins — the knight forks after recapture ideas' }
    ]}
];

export const PRACTICE: Lesson[] = [
  { id:'mate1', title:'Mate in 1', desc:'Find the only winning move.',
    fen:'6k1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1',
    steps:[ { from:'b2', to:'b8', caption:'Qb8# — back-rank mate!' } ]},
  { id:'mate1b', title:'Mate in 1 (II)', desc:'Use the queen + king team.',
    fen:'7k/6Q1/6K1/8/8/8/8/8 w - - 0 1',
    steps:[ { from:'g7', to:'h7', caption:'Qh7# — queen delivers mate, king guards' } ]},
  { id:'tactic', title:'Win the Queen', desc:'Spot the fork.',
    fen:'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPPQPPP/R1B2RK1 w kq - 0 1',
    steps:[ { from:'f3', to:'e5', caption:'Nxe5 wins material via the fork' } ]}
];

export const ENDGAMES: Lesson[] = [
  { id:'kqk', title:'King + Queen vs King', desc:'Push the king to the edge, then mate.',
    fen:'8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1',
    steps:[
      { from:'e2', to:'d3', caption:'Cut the king off with the queen' },
      { from:'e5', to:'f4', caption:'Black resists' },
      { from:'e1', to:'f2', caption:'Bring your king closer — never stalemate!' }
    ]},
  { id:'krk', title:'King + Rook vs King', desc:'Build a "box" and shrink it.',
    fen:'8/8/8/3k4/8/8/3R4/3K4 w - - 0 1',
    steps:[
      { from:'d2', to:'e2', caption:'Cut the board in half' },
      { from:'d5', to:'d4', caption:'Black approaches' },
      { from:'d1', to:'d2', caption:'King supports the rook' }
    ]},
  { id:'kpk', title:'King + Pawn', desc:'The king must lead the pawn to promotion.',
    fen:'8/8/8/8/3k4/3P4/3K4/8 w - - 0 1',
    steps:[
      { from:'d2', to:'e2', caption:'King in front of the pawn = winning' },
      { from:'d4', to:'e5', caption:'Black tries to block' },
      { from:'e2', to:'e3', caption:'March forward with opposition' }
    ]}
];