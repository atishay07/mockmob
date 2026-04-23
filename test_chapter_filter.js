async function test() {
  const chapter = "Share Capital";
  const url = `http://localhost:3000/api/questions/explore?subject=accountancy&chapter=${encodeURIComponent(chapter)}`;
  console.log(`Fetching: ${url}`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`Found ${data.questions ? data.questions.length : 0} questions for chapter "${chapter}".`);
    if (data.questions && data.questions.length > 0) {
      console.log("Sample:", data.questions[0].questions.body.substring(0, 50) + "...");
    }
  } catch (e) {
    console.error(e);
  }
}
test();
