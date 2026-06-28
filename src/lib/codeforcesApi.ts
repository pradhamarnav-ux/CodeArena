export async function fetchRandomProblems(
  minRating: number,
  maxRating: number,
  count: number,
) {
  const res = await fetch("https://codeforces.com/api/problemset.problems");
  if (!res.ok) throw new Error("Failed to fetch CF problems");

  const data = await res.json();
  if (data.status !== "OK") throw new Error(data.comment || "API Error");

  const problems = data.result.problems.filter(
    (p: any) =>
      p.rating >= minRating &&
      p.rating <= maxRating &&
      p.tags &&
      !p.tags.includes("*special"),
  );

  if (problems.length < count) {
    throw new Error(
      `Only ${problems.length} problems found in this rating range.`,
    );
  }

  // Shuffle
  const shuffled = [...problems].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  return selected.map((p: any) => ({
    id: `${p.contestId}${p.index}`,
    name: p.name,
    rating: p.rating,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
  }));
}

export async function verifyUserExists(handle: string) {
  try {
    const res = await fetch(
      `https://codeforces.com/api/user.info?handles=${handle}`,
    );
    const data = await res.json();
    return data.status === "OK";
  } catch {
    return false;
  }
}
