async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/questions/explore?subject=accountancy");
    const data = await res.json();
    console.log(`Found ${data.questions ? data.questions.length : 0} questions.`);
    if (data.questions && data.questions.length > 0) {
      console.log("First question:", data.questions[0].questions.body);
    } else {
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
