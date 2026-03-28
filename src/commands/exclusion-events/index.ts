import { excludeEvent } from "./exclude-event";
import { excludeEventForm } from "./exclude-event-form";

export const events = {
  excludeEvent: {
    ...excludeEvent,
    ...excludeEventForm,
  },
};
