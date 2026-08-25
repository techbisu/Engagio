import bcrypt from "bcryptjs"
// Seed script: run with `bun run db:seed`
import { db } from "../src/lib/db"
import { generateQuizSlug } from "../src/lib/utils"

async function main() {
  console.log("🌱 Seeding QuizMaster Pro...")

  // Create demo admin
  const admin = await db.user.upsert({
    where: { email: "admin@quizmaster.pro" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@quizmaster.pro",
      name: "Quiz Admin",
      role: "ADMIN",
    },
  })
  console.log(`  ✓ Admin: ${admin.email}`)

  // Create demo student
  const student = await db.user.upsert({
    where: { email: "student@quizmaster.pro" },
    update: {},
    create: {
      email: "student@quizmaster.pro",
      name: "Demo Student",
      role: "PARTICIPANT",
    },
  })
  console.log(`  ✓ Student: ${student.email}`)

  // Create event
  const event = await db.event.create({
    data: {
      title: "Web Dev Workshop 2025",
      description:
        "A 2-day intensive workshop covering modern full-stack web development with Next.js, TypeScript, and Prisma. Test your knowledge with this quick quiz covering key workshop topics.",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2026-12-31"),
      isActive: true,
    },
  })
  console.log(`  ✓ Event: ${event.title}`)

  const sampleQuestions = [
    {
      question: "Which hook in React is used to manage side effects?",
      options: ["useState", "useEffect", "useContext", "useReducer"],
      correctAnswer: 1,
      explanation: "useEffect runs side effects after render.",
      marks: 1,
    },
    {
      question: "What does Prisma primarily provide for a Next.js application?",
      options: [
        "A CSS framework",
        "An ORM for database access",
        "A state management library",
        "A build tool",
      ],
      correctAnswer: 1,
      explanation: "Prisma is a type-safe ORM.",
      marks: 1,
    },
    {
      question: "In Next.js App Router, which file convention defines a route handler?",
      options: ["page.tsx", "route.ts", "layout.tsx", "loading.tsx"],
      correctAnswer: 1,
      explanation: "route.ts defines HTTP handlers in App Router.",
      marks: 1,
    },
    {
      question: "Which TypeScript keyword/symbol defines an optional property?",
      options: ["!", "?:", "optional", "null"],
      correctAnswer: 1,
      explanation: "The ? after the property name marks it optional.",
      marks: 1,
    },
    {
      question: "What is the output of `typeof null` in JavaScript?",
      options: ["null", "undefined", "object", "number"],
      correctAnswer: 2,
      explanation: "This is a long-standing JS quirk — typeof null is 'object'.",
      marks: 1,
    },
    {
      question: "Which CSS property is used to create flexible box layouts?",
      options: ["display: flex", "flex-direction", "flexbox", "grid"],
      correctAnswer: 0,
      explanation: "`display: flex` enables flexbox layout.",
      marks: 1,
    },
    {
      question: "Tailwind CSS uses which approach for styling?",
      options: [
        "Component-based CSS",
        "Utility-first CSS",
        "CSS-in-JS",
        "BEM naming",
      ],
      correctAnswer: 1,
      explanation: "Tailwind is a utility-first framework.",
      marks: 1,
    },
    {
      question: "Which HTTP method is idempotent and used for fetching resources?",
      options: ["POST", "GET", "PATCH", "DELETE"],
      correctAnswer: 1,
      explanation: "GET is safe and idempotent.",
      marks: 1,
    },
    {
      question: "What does JWT stand for?",
      options: [
        "Java Web Token",
        "JSON Web Token",
        "JavaScript Web Transmission",
        "Joint Web Type",
      ],
      correctAnswer: 1,
      explanation: "JWT = JSON Web Token (RFC 7519).",
      marks: 1,
    },
    {
      question: "Which is NOT a valid React component lifecycle phase?",
      options: ["Mounting", "Updating", "Unmounting", "Rebooting"],
      correctAnswer: 3,
      explanation: "React has mounting, updating, and unmounting phases.",
      marks: 1,
    },
  ]

  for (const [i, q] of sampleQuestions.entries()) {
    await db.question.create({
      data: {
        eventId: event.id,
        question: q.question,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        marks: q.marks,
        order: i,
        explanation: q.explanation,
      },
    })
  }
  console.log(`  ✓ ${sampleQuestions.length} questions`)

  // Create quiz link
  const slug = generateQuizSlug(6)
  const quizLink = await db.quizLink.create({
    data: {
      eventId: event.id,
      slug,
      isActive: true,
      shuffleQuestions: true,
      shuffleOptions: false,
      timeLimit: 15,
      maxAttempts: 1,
      showResults: true,
      passThreshold: 60,
      requireFullscreen: true,
    },
  })
  console.log(`  ✓ Quiz link: ${quizLink.slug}`)

  console.log("\n✅ Seed complete.")
  console.log(`   Quiz URL: /?quiz=${quizLink.slug}`)
  console.log(`   Admin login: admin@quizmaster.pro (any password)`)
  console.log(`   Student login: student@quizmaster.pro (any password)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
