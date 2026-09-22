import { describe, expect, it } from "vitest";

import { formatMembers, resolveMembers } from "../../../src/util/member-flags.js";

describe("resolveMembers", () => {
  it("omits the field when neither flag is passed — visible to every member of the owner", () => {
    expect(resolveMembers({})).toBeUndefined();
    expect(resolveMembers({ member: [] })).toBeUndefined();
  });

  it("maps --members-admins-only to the empty list", () => {
    expect(resolveMembers({ membersAdminsOnly: true })).toEqual([]);
  });

  it("passes a --member list through", () => {
    expect(resolveMembers({ member: ["me", "a@b.co"] })).toEqual(["me", "a@b.co"]);
  });

  it("rejects the two flags together rather than silently picking one", () => {
    expect(() =>
      resolveMembers({ member: ["me"], membersAdminsOnly: true }),
    ).toThrowError(/Cannot combine --member with --members-admins-only/);
  });
});

describe("formatMembers", () => {
  it("tells null (everyone) apart from [] (admins only)", () => {
    expect(formatMembers(null)).toBe("(everyone)");
    expect(formatMembers(undefined)).toBe("(everyone)");
    expect(formatMembers([])).toBe("(admins only)");
  });

  it("names the users of a non-empty list", () => {
    expect(formatMembers([{ oid: "o1", name: "Ada" }, { oid: "o2", name: "Bo" }])).toBe("Ada, Bo");
  });

  it("falls back to the OID when a user object carries no name", () => {
    expect(formatMembers([{ oid: "o1" }])).toBe("o1");
  });

  it("still reads the pre-Sep-2026 shape, where members were bare OID strings", () => {
    expect(formatMembers(["o1", "o2"])).toBe("o1, o2");
  });
});
