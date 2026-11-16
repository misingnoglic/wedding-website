import CourseMenu, { Course } from './CourseMenu'

const COURSES: Course[] = [
  {
    title: 'Sashimi',
    dishes: [
      { name: 'Bluefin tuna', diet: ['DF', 'GF'] },
      { name: 'Salmon', diet: ['DF', 'GF'] },
      { name: 'Local catch', diet: ['DF', 'GF'] },
    ],
  },
  {
    title: 'Makis',
    dishes: [
      { name: 'Spicy tuna with cucumber and avocado', diet: ['DF', 'GF'] },
      { name: 'Salmon with cream cheese, cucumber and masago', diet: ['GF'] },
      { name: 'BBQ eel with soy paper, avocado, cucumber and chipotle mayonnaise', diet: ['GF'] },
    ],
  },
  {
    title: 'Rolls',
    dishes: [
      { name: 'California with cream cheese, avocado, kanikama and shrimp', diet: ['GF'] },
      { name: 'Spicy tuna, avocado, cucumber and chives', diet: ['GF'] },
      { name: 'Shrimp tempura, avocado, carrot and local catch', diet: ['DF'] },
      { name: 'Asparagus, dried tomato, avocado and cucumber', diet: ['DF', 'GF', 'VG'] },
    ],
  },
  {
    title: 'Nigiri',
    dishes: [
      { name: 'Salmon', diet: ['DF', 'GF'] },
      { name: 'Shrimp', diet: ['DF', 'GF'] },
      { name: 'Tuna', diet: ['DF', 'GF'] },
      { name: 'Local catch', diet: ['DF', 'GF'] },
    ],
  },
]

export default function SushiMenu() {
  return <CourseMenu courses={COURSES} />
}
