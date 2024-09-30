import winston from "winston";
const { format } = winston;
const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export default function createLogger(classLabel) {
  return winston.createLogger({
    level: "info",
    format: combine(timestamp(), label({ label: classLabel }), myFormat),
    transports: [
      new winston.transports.File({
        filename: "./logs/error.log",
        level: "error",
      }),
      new winston.transports.File({ filename: "./logs/mp3stream.log" }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.align(),
          winston.format.printf((debug) => {
            const { timestamp, level, message } = debug;

            const ts = timestamp.slice(0, 19).replace("T", " ");
            return `${ts} [${level}]: ${message}`;
          })
        ),
      }),
    ],
  });
}
