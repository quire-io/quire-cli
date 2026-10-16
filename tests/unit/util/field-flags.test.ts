import { describe, expect, it } from "vitest";

import { buildFieldBody } from "../../../src/util/field-flags.js";

describe("buildFieldBody", () => {
  it("returns an empty object for empty flags", () => {
    expect(buildFieldBody({})).toEqual({});
  });

  it("includes name and type when present", () => {
    expect(buildFieldBody({ name: "x", type: "number" })).toEqual({
      name: "x",
      type: "number",
    });
  });

  it("only includes the one-way boolean flags when set to true (not just defined)", () => {
    expect(
      buildFieldBody({
        hidden: false,
        percent: false,
        multiple: false,
        clearOnDup: false,
      }),
    ).toEqual({});
    expect(
      buildFieldBody({
        hidden: true,
        private: true,
        percent: true,
        multiple: true,
        clearOnDup: true,
      }),
    ).toEqual({
      hidden: true,
      private: true,
      percent: true,
      multiple: true,
      clearOnDup: true,
    });
  });

  it("sends private and locked as given, so update's --no-private / --no-locked clear them", () => {
    expect(buildFieldBody({ private: false, locked: false })).toEqual({ private: false, locked: false });
    expect(buildFieldBody({ locked: true })).toEqual({ locked: true });
  });

  it("maps the view / edit member flags to a list, [] or null", () => {
    expect(buildFieldBody({ viewMember: ["me", "a@x.io"], editMembersAdminsOnly: true })).toEqual({
      viewMembers: ["me", "a@x.io"],
      editMembers: [],
    });
    expect(buildFieldBody({ viewMembersAnyone: true, editMembersAnyone: true })).toEqual({
      viewMembers: null,
      editMembers: null,
    });
    expect(buildFieldBody({ viewMember: [], editMember: [] })).toEqual({});
  });

  it("rejects more than one of a list's three forms", () => {
    expect(() => buildFieldBody({ viewMember: ["me"], viewMembersAdminsOnly: true })).toThrowError(
      /only one of --view-member/,
    );
    expect(() => buildFieldBody({ editMembersAdminsOnly: true, editMembersAnyone: true })).toThrowError(
      /only one of --edit-member/,
    );
  });

  it("rejects --no-private with view members, which Quire 400s on", () => {
    expect(() => buildFieldBody({ private: false, viewMembersAdminsOnly: true })).toThrowError(
      /Cannot combine --no-private/,
    );
    // Lifting the restriction is fine: the field stays private until told otherwise.
    expect(buildFieldBody({ private: false, viewMembersAnyone: true })).toEqual({
      private: false,
      viewMembers: null,
    });
  });

  it("parses --extra key=value as JSON when possible", () => {
    expect(
      buildFieldBody({
        extra: ['count=5', 'enabled=true', 'tags=["a","b"]', "label=hello"],
      }),
    ).toEqual({
      count: 5,
      enabled: true,
      tags: ["a", "b"],
      label: "hello",
    });
  });

  it("falls back to raw string when JSON.parse fails", () => {
    expect(buildFieldBody({ extra: ["formula=SUM(x, y)"] })).toEqual({
      formula: "SUM(x, y)",
    });
  });

  it("rejects malformed --extra entries (no =)", () => {
    expect(() => buildFieldBody({ extra: ["nokey"] })).toThrowError(/Expected key=value/);
  });

  it("rejects --extra entries starting with =", () => {
    expect(() => buildFieldBody({ extra: ["=value"] })).toThrowError(/Expected key=value/);
  });
});
