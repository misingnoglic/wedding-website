import CourseMenu, { Course } from './CourseMenu'

const COURSES: Course[] = [
  {
    title: 'Appetizers',
    dishes: [
      { name: 'Guacamole, pico de gallo, Cotija cheese, corn tortilla chips', diet: ['GF'] },
      { name: 'Clam ceviche with chiles toreados, soy sauce and lemon', diet: ['DF', 'GF'] },
      { name: 'Grilled octopus salad, artichoke, kale and fennel vinaigrette', diet: ['DF', 'GF'] },
      { name: 'Bluefin tuna on corn tostada, avocado, cucumber and citrus soy sauce', diet: ['DF', 'GF'] },
      { name: 'Fusilli and heirloom salad, feta cheese, nuts and basil pesto' },
    ],
  },
  {
    title: 'Mains',
    dishes: [
      { name: 'Beef lasagna, béchamel, asadero and mozzarella cheese, roasted tomatoes' },
      { name: 'Spiced chipotle and olive salmon empanadas', diet: ['DF'] },
      { name: 'Eggplant and pumpkin ratatouille, pomodoro sauce, Grana Padano', diet: ['DF', 'GF'] },
      { name: 'Shrimp, mussel and chicken paella, artichoke, vegetables and lemon wedge', diet: ['GF'] },
      { name: 'Grilled organic vegetables with traditional chimichurri', diet: ['DF', 'GF', 'VG'] },
    ],
  },
  {
    title: 'From the Grill',
    dishes: [
      { name: 'Giga oyster with herbed butter', diet: ['GF'] },
      { name: 'Pasilla and piloncillo marinated rack of lamb', diet: ['DF', 'GF'] },
      { name: 'Roasted local catch, parsley butter sauce, capers and lime', diet: ['GF'] },
      { name: 'Roasted rump steak with balsamic and rosemary glaze', diet: ['DF', 'GF'] },
    ],
  },
  {
    title: 'Desserts',
    dishes: [
      { name: 'Pistachio baklava' },
      { name: 'Eclair with rosemary and goat cheese cream' },
      { name: 'Opera cake with dates and caramel' },
      { name: 'Orange cheesecake' },
    ],
  },
]

export default function DinnerMenu() {
  return <CourseMenu courses={COURSES} />
}
