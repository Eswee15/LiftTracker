import type { Equipment, Exercise } from './db';

export const MUSCLES = [
  'Chest', 'Upper Chest', 'Lats', 'Upper Back', 'Lower Back', 'Traps',
  'Front Delts', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Forearms',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Obliques',
  'Adductors', 'Abductors', 'Hip Flexors', 'Neck', 'Cardio',
];

const EQ: Record<string, Equipment> = { B: 'barbell', D: 'dumbbell', M: 'machine', C: 'cable', W: 'bodyweight', O: 'other' };

// Name | equipment | primary muscles | secondary muscles
const RAW = `
Barbell Bench Press|B|Chest|Triceps,Front Delts
Incline Barbell Bench Press|B|Upper Chest|Triceps,Front Delts
Decline Barbell Bench Press|B|Chest|Triceps
Close-Grip Bench Press|B|Triceps|Chest,Front Delts
Dumbbell Bench Press|D|Chest|Triceps,Front Delts
Incline Dumbbell Press|D|Upper Chest|Triceps,Front Delts
Decline Dumbbell Press|D|Chest|Triceps
Dumbbell Fly|D|Chest|Front Delts
Incline Dumbbell Fly|D|Upper Chest|Front Delts
Machine Chest Press|M|Chest|Triceps,Front Delts
Incline Machine Press|M|Upper Chest|Triceps,Front Delts
Pec Deck|M|Chest|Front Delts
Cable Crossover|C|Chest|Front Delts
Low-to-High Cable Fly|C|Upper Chest|Front Delts
High-to-Low Cable Fly|C|Chest|
Push-Up|W|Chest|Triceps,Front Delts
Chest Dip|W|Chest|Triceps,Front Delts
Smith Machine Bench Press|M|Chest|Triceps,Front Delts
Smith Machine Incline Press|M|Upper Chest|Triceps,Front Delts
Landmine Press|B|Upper Chest|Front Delts,Triceps
Deadlift|B|Lower Back,Hamstrings,Glutes|Traps,Forearms,Quads
Sumo Deadlift|B|Glutes,Adductors,Hamstrings|Lower Back,Quads,Traps
Romanian Deadlift|B|Hamstrings,Glutes|Lower Back
Dumbbell Romanian Deadlift|D|Hamstrings,Glutes|Lower Back
Stiff-Leg Deadlift|B|Hamstrings|Glutes,Lower Back
Trap Bar Deadlift|B|Quads,Glutes,Hamstrings|Lower Back,Traps
Rack Pull|B|Upper Back,Lower Back|Traps,Glutes,Forearms
Barbell Row|B|Lats,Upper Back|Biceps,Rear Delts,Lower Back
Pendlay Row|B|Upper Back,Lats|Biceps,Rear Delts
Dumbbell Row|D|Lats|Upper Back,Biceps,Rear Delts
Chest-Supported Row|M|Upper Back|Lats,Rear Delts,Biceps
T-Bar Row|B|Upper Back,Lats|Biceps,Rear Delts
Seated Cable Row|C|Lats,Upper Back|Biceps,Rear Delts
Machine Row|M|Lats,Upper Back|Biceps,Rear Delts
Single-Arm Cable Row|C|Lats|Biceps,Rear Delts
Meadows Row|B|Lats|Upper Back,Biceps
Inverted Row|W|Upper Back,Lats|Biceps,Rear Delts
Pull-Up|W|Lats|Biceps,Upper Back
Chin-Up|W|Lats,Biceps|Upper Back
Neutral-Grip Pull-Up|W|Lats|Biceps,Upper Back
Weighted Pull-Up|W|Lats|Biceps,Upper Back
Assisted Pull-Up|M|Lats|Biceps
Lat Pulldown|C|Lats|Biceps,Upper Back
Close-Grip Lat Pulldown|C|Lats|Biceps
Single-Arm Lat Pulldown|C|Lats|Biceps
Straight-Arm Pulldown|C|Lats|Triceps
Machine Pulldown|M|Lats|Biceps
Dumbbell Pullover|D|Lats|Chest,Triceps
Back Extension|W|Lower Back|Glutes,Hamstrings
Good Morning|B|Lower Back,Hamstrings|Glutes
Barbell Shrug|B|Traps|Forearms
Dumbbell Shrug|D|Traps|Forearms
Cable Shrug|C|Traps|
Overhead Press|B|Front Delts|Triceps,Side Delts,Upper Chest
Seated Barbell Press|B|Front Delts|Triceps,Side Delts
Dumbbell Shoulder Press|D|Front Delts,Side Delts|Triceps
Arnold Press|D|Front Delts,Side Delts|Triceps
Machine Shoulder Press|M|Front Delts,Side Delts|Triceps
Push Press|B|Front Delts|Triceps,Quads
Dumbbell Lateral Raise|D|Side Delts|Traps
Cable Lateral Raise|C|Side Delts|
Machine Lateral Raise|M|Side Delts|
Front Raise|D|Front Delts|Upper Chest
Cable Front Raise|C|Front Delts|
Rear Delt Fly|D|Rear Delts|Upper Back
Reverse Pec Deck|M|Rear Delts|Upper Back
Cable Rear Delt Fly|C|Rear Delts|Upper Back
Face Pull|C|Rear Delts|Upper Back,Traps
Upright Row|B|Side Delts,Traps|Biceps
Barbell Curl|B|Biceps|Forearms
EZ-Bar Curl|B|Biceps|Forearms
Dumbbell Curl|D|Biceps|Forearms
Hammer Curl|D|Biceps,Forearms|
Incline Dumbbell Curl|D|Biceps|
Preacher Curl|B|Biceps|
Machine Preacher Curl|M|Biceps|
Concentration Curl|D|Biceps|
Cable Curl|C|Biceps|Forearms
Rope Hammer Curl|C|Biceps,Forearms|
Spider Curl|D|Biceps|
Bayesian Curl|C|Biceps|
Reverse Curl|B|Forearms,Biceps|
Wrist Curl|D|Forearms|
Reverse Wrist Curl|D|Forearms|
Farmer's Walk|O|Forearms,Traps|Abs,Glutes
Tricep Pushdown|C|Triceps|
Rope Pushdown|C|Triceps|
Overhead Cable Tricep Extension|C|Triceps|
Skullcrusher|B|Triceps|
Dumbbell Skullcrusher|D|Triceps|
Overhead Dumbbell Extension|D|Triceps|
Tricep Dip|W|Triceps|Chest,Front Delts
Bench Dip|W|Triceps|Front Delts
Machine Tricep Extension|M|Triceps|
Cable Kickback|C|Triceps|
Dumbbell Kickback|D|Triceps|
Diamond Push-Up|W|Triceps|Chest
Barbell Back Squat|B|Quads,Glutes|Hamstrings,Lower Back,Abs
Barbell Front Squat|B|Quads|Glutes,Abs
Low-Bar Squat|B|Glutes,Quads|Hamstrings,Lower Back
Goblet Squat|D|Quads,Glutes|Abs
Smith Machine Squat|M|Quads,Glutes|
Hack Squat|M|Quads|Glutes
Leg Press|M|Quads,Glutes|Hamstrings,Adductors
Pendulum Squat|M|Quads|Glutes
Bulgarian Split Squat|D|Quads,Glutes|Hamstrings
Walking Lunge|D|Quads,Glutes|Hamstrings
Reverse Lunge|D|Glutes,Quads|Hamstrings
Barbell Lunge|B|Quads,Glutes|Hamstrings
Step-Up|D|Quads,Glutes|
Leg Extension|M|Quads|
Lying Leg Curl|M|Hamstrings|Calves
Seated Leg Curl|M|Hamstrings|Calves
Nordic Hamstring Curl|W|Hamstrings|
Glute-Ham Raise|W|Hamstrings,Glutes|Lower Back
Hip Thrust|B|Glutes|Hamstrings
Machine Hip Thrust|M|Glutes|Hamstrings
Glute Bridge|B|Glutes|Hamstrings
Cable Pull-Through|C|Glutes,Hamstrings|Lower Back
Cable Kickback (Glute)|C|Glutes|Hamstrings
Hip Abduction Machine|M|Abductors|Glutes
Hip Adduction Machine|M|Adductors|
Standing Calf Raise|M|Calves|
Seated Calf Raise|M|Calves|
Leg Press Calf Raise|M|Calves|
Smith Machine Calf Raise|M|Calves|
Donkey Calf Raise|M|Calves|
Tibialis Raise|W|Calves|
Crunch|W|Abs|
Cable Crunch|C|Abs|
Machine Crunch|M|Abs|
Hanging Leg Raise|W|Abs,Hip Flexors|Obliques
Hanging Knee Raise|W|Abs,Hip Flexors|
Captain's Chair Leg Raise|W|Abs,Hip Flexors|
Ab Wheel Rollout|O|Abs|Lower Back,Lats
Plank|W|Abs|Obliques,Lower Back
Side Plank|W|Obliques|Abs
Russian Twist|W|Obliques|Abs
Cable Woodchopper|C|Obliques|Abs
Pallof Press|C|Obliques,Abs|
Decline Sit-Up|W|Abs|Hip Flexors
Dragon Flag|W|Abs|Hip Flexors
Power Clean|B|Quads,Glutes,Traps|Hamstrings,Lower Back,Front Delts
Hang Clean|B|Traps,Glutes,Quads|Hamstrings,Front Delts
Clean and Press|B|Front Delts,Quads,Traps|Triceps,Glutes
Kettlebell Swing|O|Glutes,Hamstrings|Lower Back,Abs
Turkish Get-Up|O|Abs,Front Delts|Glutes,Quads
Sled Push|O|Quads,Glutes|Calves,Hamstrings
Battle Ropes|O|Front Delts,Cardio|Abs,Forearms
Neck Curl|O|Neck|
Neck Extension|O|Neck|Traps
Treadmill Run|O|Cardio|Quads,Calves
Stationary Bike|O|Cardio|Quads
Rowing Machine|O|Cardio|Lats,Quads
Stair Climber|O|Cardio|Glutes,Quads
Elliptical|O|Cardio|
`;

export function seedExercises(): Omit<Exercise, 'id'>[] {
  return RAW.trim().split('\n').map((line) => {
    const [name, eq, pri, sec] = line.split('|');
    const equipment = EQ[eq];
    const small = /Lateral Raise|Rear Delt Fly/.test(name) && equipment === 'dumbbell';
    return {
      name,
      equipment,
      muscles: pri.split(',').filter(Boolean),
      secondary: (sec ?? '').split(',').filter(Boolean),
      increment: small ? 1 : 2.5,
      venueSpecific: equipment === 'machine' || equipment === 'cable',
      custom: false,
    };
  });
}
