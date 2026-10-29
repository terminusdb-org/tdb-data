// @vitest-environment node
import { describe, expect, it } from "vitest";
import reducer, { editDismissed, editFailed, editStarted, editSucceeded, selectPendingForElement } from "./modelSlice";
import reducerNotify, { dismissNotification, notify, selectNotifications } from "./notificationSlice";

describe("modelSlice", () => {
  it("tracks pending edits per element id", () => {
    let state = reducer(undefined, editStarted({ id: "e1", elementId: "Person", ops: [{ "@type": "DeleteClassProperty" }] }));
    state = reducer(state, editStarted({ id: "e2", elementId: "Address", ops: [{ "@type": "CreateClassProperty" }] }));
    expect(selectPendingForElement({ model: state }, "Person")).toHaveLength(1);
    expect(selectPendingForElement({ model: state }, "Person")[0].status).toBe("applying");
  });

  it("marks edits failed with error detail, keeping them for retry", () => {
    let state = reducer(undefined, editStarted({ id: "e1", elementId: "Person", ops: [] }));
    state = reducer(
      state,
      editFailed({ id: "e1", error: { type: "api:WeakeningFailure", message: "m", detailsJson: "{}" } })
    );
    const [edit] = selectPendingForElement({ model: state }, "Person");
    expect(edit.status).toBe("error");
    expect(edit.error?.type).toBe("api:WeakeningFailure");
  });

  it("removes edits on success or dismiss", () => {
    let state = reducer(undefined, editStarted({ id: "e1", elementId: "Person", ops: [] }));
    state = reducer(state, editSucceeded({ id: "e1" }));
    expect(state.pendingEdits).toHaveLength(0);
    state = reducer(state, editStarted({ id: "e2", elementId: "Person", ops: [] }));
    state = reducer(state, editDismissed({ id: "e2" }));
    expect(state.pendingEdits).toHaveLength(0);
  });
});

describe("notificationSlice", () => {
  it("adds and dismisses notifications", () => {
    let state = reducerNotify(undefined, notify({ severity: "error", title: "Migration failed" }));
    expect(selectNotifications({ notification: state })).toHaveLength(1);
    const id = state.items[0].id;
    state = reducerNotify(state, dismissNotification({ id }));
    expect(state.items).toHaveLength(0);
  });
});
