async function check() {
  const res = await fetch("http://localhost:3000/api/subjects");
  const data = await res.json();
  console.log("Subjects:", data);
}
check();
