import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

winston.level = 'info';
winston.add(
    new winston.transports.Console({
        // level: 'debug',
        format: winston.format.combine(
            winston.format.padLevels(),
            winston.format.timestamp({
                format: 'DD-MM-YYYY HH:mm:ss.SSS',
            }),
            winston.format.colorize(),
            winston.format.printf((info) => {
                const padding: number = info.message.length - info.message.trimLeft().length;

                return `${info.timestamp} [${
                    ' '.repeat(padding - 1) + info.level
                }] ${info.message.trim()}`;
            })
        ),
    })
);

export default {
    LUXACAST_HOST: process.env['LUXACAST_HOST'] ?? 'ws://localhost:8080',
    LUXACAST_GROUP: process.env['LUXACAST_GROUP'] ?? 'joris',
};
