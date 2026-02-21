import {useMemo} from 'react';

const isCreditRole = (person, role) => {
	const type = String(person?.Type || '').toLowerCase();
	const personRole = String(person?.Role || '').toLowerCase();
	if (role === 'director') {
		return type === 'director' || personRole === 'director';
	}
	if (role === 'writer') {
		return type === 'writer' || personRole.includes('writer');
	}
	return false;
};

const toUniqueNames = (peopleList) => {
	return [...new Set(peopleList.map((person) => person?.Name).filter(Boolean))];
};

export const useMediaCredits = ({
	detailPeople,
	seasonPeople,
	episodePeople,
	itemPeople
}) => {
	const people = useMemo(() => {
		const mergedPeople = [
			...(Array.isArray(detailPeople) ? detailPeople : []),
			...(Array.isArray(seasonPeople) ? seasonPeople : []),
			...(Array.isArray(episodePeople) ? episodePeople : []),
			...(Array.isArray(itemPeople) ? itemPeople : [])
		];
		const seen = new Set();
		return mergedPeople.filter((person) => {
			const uniqueKey = `${person?.Id || person?.Name || ''}:${person?.Type || ''}:${person?.Role || ''}`;
			if (seen.has(uniqueKey)) return false;
			seen.add(uniqueKey);
			return true;
		});
	}, [detailPeople, episodePeople, itemPeople, seasonPeople]);

	const cast = useMemo(() => {
		return people.filter((person) => person?.Type === 'Actor');
	}, [people]);

	const directorNames = useMemo(() => {
		return toUniqueNames(people.filter((person) => isCreditRole(person, 'director')));
	}, [people]);

	const writerNames = useMemo(() => {
		return toUniqueNames(people.filter((person) => isCreditRole(person, 'writer')));
	}, [people]);

	const hasCreatorCredits = directorNames.length > 0 || writerNames.length > 0;

	return {
		people,
		cast,
		directorNames,
		writerNames,
		hasCreatorCredits
	};
};
