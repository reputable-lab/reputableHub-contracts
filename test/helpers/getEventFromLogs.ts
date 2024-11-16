export const getEventFromLogs = ({ eventName, logs }: { eventName: string; logs: any[] }) => {
  const eventFound = logs.find(log => log.eventName === eventName);
  if (!eventFound) {
    throw new Error(`Unknown event ${eventName}`);
  }
  return eventFound;
};
