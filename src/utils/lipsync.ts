export type VisemeName =
	| "viseme_sil"
	| "viseme_PP"
	| "viseme_FF"
	| "viseme_TH"
	| "viseme_DD"
	| "viseme_kk"
	| "viseme_CH"
	| "viseme_SS"
	| "viseme_nn"
	| "viseme_RR"
	| "viseme_aa"
	| "viseme_E"
	| "viseme_I"
	| "viseme_O"
	| "viseme_U";

export interface WordBoundaryLike {
	offset: number;
	duration: number;
	text: string;
}

export interface VisemeCue {
	start: number;
	end: number;
	viseme: VisemeName;
	word: string;
}

const HUNDRED_NS_TO_SECONDS = 1e7;

const sanitizeWord = (word: string): string =>
	word.toLowerCase().replace(/[^a-z']/g, "");

const collapseConsecutiveVisemes = (
	visemes: VisemeName[],
): VisemeName[] => {
	const collapsed: VisemeName[] = [];
	for (const viseme of visemes) {
		if (collapsed.at(-1) !== viseme) collapsed.push(viseme);
	}
	return collapsed;
};

export const wordToVisemes = (word: string): VisemeName[] => {
	const clean = sanitizeWord(word);
	if (!clean) return ["viseme_sil"];

	const visemes: VisemeName[] = [];
	let index = 0;

	while (index < clean.length) {
		const nextTwo = clean.slice(index, index + 2);
		const char = clean[index];

		if (nextTwo === "th") {
			visemes.push("viseme_TH");
			index += 2;
			continue;
		}
		if (nextTwo === "ch" || nextTwo === "sh" || nextTwo === "jh") {
			visemes.push("viseme_CH");
			index += 2;
			continue;
		}
		if (nextTwo === "ph") {
			visemes.push("viseme_FF");
			index += 2;
			continue;
		}
		if (nextTwo === "ng") {
			visemes.push("viseme_nn");
			index += 2;
			continue;
		}

		switch (char) {
			case "p":
			case "b":
			case "m":
				visemes.push("viseme_PP");
				break;
			case "f":
			case "v":
				visemes.push("viseme_FF");
				break;
			case "t":
			case "d":
				visemes.push("viseme_DD");
				break;
			case "k":
			case "g":
			case "q":
			case "c":
				visemes.push("viseme_kk");
				break;
			case "s":
			case "z":
			case "x":
				visemes.push("viseme_SS");
				break;
			case "n":
			case "l":
				visemes.push("viseme_nn");
				break;
			case "r":
				visemes.push("viseme_RR");
				break;
			case "a":
				visemes.push("viseme_aa");
				break;
			case "e":
				visemes.push("viseme_E");
				break;
			case "i":
			case "y":
				visemes.push("viseme_I");
				break;
			case "o":
				visemes.push("viseme_O");
				break;
			case "u":
			case "w":
				visemes.push("viseme_U");
				break;
			default:
				break;
		}

		index += 1;
	}

	const collapsed = collapseConsecutiveVisemes(visemes);
	return collapsed.length > 0 ? collapsed : ["viseme_sil"];
};

const buildWordCue = (
	word: string,
	start: number,
	end: number,
): VisemeCue[] => {
	if (end <= start) return [];

	const visemes = wordToVisemes(word);
	const duration = end - start;
	const segmentDuration = duration / visemes.length;

	return visemes.map((viseme, idx) => ({
		start: start + idx * segmentDuration,
		end: start + (idx + 1) * segmentDuration,
		viseme,
		word,
	}));
};

export const createVisemeTrackFromWordBoundaries = (
	boundaries: WordBoundaryLike[],
): VisemeCue[] => {
	if (!boundaries.length) return [];

	const sorted = [...boundaries].sort((a, b) => a.offset - b.offset);
	const track: VisemeCue[] = [];
	let previousEnd = 0;

	for (const boundary of sorted) {
		const start = boundary.offset / HUNDRED_NS_TO_SECONDS;
		const end = (boundary.offset + boundary.duration) / HUNDRED_NS_TO_SECONDS;
		if (start > previousEnd) {
			track.push({
				start: previousEnd,
				end: start,
				viseme: "viseme_sil",
				word: "",
			});
		}
		track.push(...buildWordCue(boundary.text, start, end));
		previousEnd = Math.max(previousEnd, end);
	}

	track.push({
		start: previousEnd,
		end: previousEnd + 0.08,
		viseme: "viseme_sil",
		word: "",
	});

	return track;
};

export const createVisemeTrackFromTranscript = (
	transcript: string,
	audioDurationSeconds: number,
): VisemeCue[] => {
	const words = transcript.split(/\s+/).filter(Boolean);
	if (!words.length) return [];

	const totalDuration =
		audioDurationSeconds > 0
			? audioDurationSeconds
			: Math.max(words.length * 0.35, 0.8);
	const slotDuration = totalDuration / words.length;
	const track: VisemeCue[] = [];

	words.forEach((word, idx) => {
		const start = idx * slotDuration;
		const end = (idx + 1) * slotDuration;
		track.push(...buildWordCue(word, start, end));
	});

	track.push({
		start: totalDuration,
		end: totalDuration + 0.08,
		viseme: "viseme_sil",
		word: "",
	});

	return track;
};
