import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLensWorkspace } from "./lens-workspace";

describe("photo workspace", () => {
  it("retains photos and notes when closed and reopened until explicitly deleted", () => {
    const photo = new File(["image"], "chair.jpg", { type: "image/jpeg" });
    const first = renderHook(() => useLensWorkspace("buyer-retention:composer"));
    act(() => { first.result.current.set("files", [photo]); first.result.current.set("note", "Blue chair"); });
    first.unmount();
    const reopened = renderHook(() => useLensWorkspace("buyer-retention:composer"));
    expect(reopened.result.current.state.files).toEqual([photo]);
    expect(reopened.result.current.state.note).toBe("Blue chair");
    act(() => reopened.result.current.set("files", []));
    expect(reopened.result.current.state.files).toEqual([]);
  });
  it("never exposes another account's photos", () => {
    const owner = renderHook(() => useLensWorkspace("owner:composer"));
    act(() => owner.result.current.set("files", [new File(["private"], "private.jpg")]));
    const other = renderHook(() => useLensWorkspace("other:composer"));
    expect(other.result.current.state.files).toEqual([]);
  });
});