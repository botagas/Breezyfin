export const shuffleArray = (values = []) => {
	const next = [...values];
	for (let index = next.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[next[index], next[randomIndex]] = [next[randomIndex], next[index]];
	}
	return next;
};

