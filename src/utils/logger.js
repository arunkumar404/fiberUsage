const winston = require('winston')
const fs = require('fs')
const path = require('path')

const ensureLogPathExists = (logPath) => {
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true })
  }
}

const getNewLogFileName = (logPath) => {
  const files = fs.readdirSync(logPath)
  let maxNumber = 0

  files.forEach((file) => {
    const fileNumber = parseInt(file.split('.')[0])
    maxNumber = Math.max(maxNumber, isNaN(fileNumber) ? 0 : fileNumber)
  })

  return `${maxNumber + 1}.log`
}

const getTodayDate = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

const logDirectory = path.join(__dirname, '..', '..', 'logs', getTodayDate())
ensureLogPathExists(logDirectory)

const logFormat = winston.format.printf(
  ({ level, message, label, timestamp }) => {
    return `[${timestamp}] [${level.toUpperCase()}] [${
      label || 'General'
    }] ${message}`
  }
)

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'DD-MM-YYYY HH:mm:ss',
    }),
    logFormat
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDirectory, getNewLogFileName(logDirectory)),
    }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
  ],
})

module.exports = logger
