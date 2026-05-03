import { deleteEvent } from "./delete-event";
import { unDeleteEvent } from "./undelete-event";

export const eventLog = {
  delete: deleteEvent,
  undelete: unDeleteEvent,
};
