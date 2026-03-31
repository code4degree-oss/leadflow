export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/login',
      permanent: false,
    },
  }
}

export default function Home() {
  // Returns nothing because we redirect server-side instantly
  return null
}
