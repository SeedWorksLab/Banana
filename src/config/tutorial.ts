export interface TutorialPage {
  icon: string;
  title: string;
  body: string;
}

export const tutorialPages: TutorialPage[] = [
  {
    icon: 'silverware-fork-knife',
    title: 'Welcome to Banana',
    body: 'Banana plans your next week of meals, tells you what to buy, and spends your food budget where the deals are. Everything lives on this device — there is no account and no cloud.',
  },
  {
    icon: 'clock-outline',
    title: 'Tell it how much time you have',
    body: 'For each day, set how long you want to spend cooking. Some days you can take an hour, some days you need something in fifteen minutes. Banana fits the plan to your time, not the other way around.',
  },
  {
    icon: 'heart-outline',
    title: 'Ask for what you fancy',
    body: 'Pin something specific to a day and Banana plans the rest of the week around it. Anything the planner suggests can be swapped by hand, any time.',
  },
  {
    icon: 'cart-outline',
    title: 'One shopping list',
    body: 'Your plan becomes a single list, grouped by aisle, with what you already have in the pantry taken off it. No more guessing how much to buy.',
  },
  {
    icon: 'sale-outline',
    title: 'Where the deals are',
    body: 'Banana reads the public offers pages at Lidl, Hofer and Spar and shows where your list is on special this week, so the budget stretches further.',
  },
  {
    icon: 'shield-lock-outline',
    title: 'Private by design',
    body: 'You never log in to a store, and no personal data leaves the app. The only network it uses is the offers pages it reads and an AI provider you choose yourself.',
  },
];
