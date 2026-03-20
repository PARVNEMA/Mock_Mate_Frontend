/**
 * Logger utility for consistent console logging with file name
 */

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

const getTimestamp = (): string => {
	return new Date().toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
	});
};

const createLogger = (fileName: string) => {
	const logWithLevel = (
		level: LogLevel,
		message: string,
		data?: unknown,
	) => {
		const timestamp = getTimestamp();
		const prefix = `[${timestamp}] [${fileName}]`;

		const logFunction = console[level];

		if (data !== undefined) {
			logFunction(`${prefix} ${message}`, data);
		} else {
			logFunction(`${prefix} ${message}`);
		}
	};

	return {
		log: (message: string, data?: unknown) =>
			logWithLevel("log", message, data),
		info: (message: string, data?: unknown) =>
			logWithLevel("info", message, data),
		warn: (message: string, data?: unknown) =>
			logWithLevel("warn", message, data),
		error: (message: string, data?: unknown) =>
			logWithLevel("error", message, data),
		debug: (message: string, data?: unknown) =>
			logWithLevel("debug", message, data),
	};
};

export default createLogger;
