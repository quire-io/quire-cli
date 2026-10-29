import { describe, expect, it } from "vitest";

import { withCreator, withCreatorInItems } from "../../../src/util/followers.js";

describe("withCreator", () => {
  it("makes the creator the only follower when none are given", () => {
    expect(withCreator(undefined)).toEqual(["me"]);
    expect(withCreator([])).toEqual(["me"]);
  });

  it("appends the creator to the listed followers", () => {
    expect(withCreator(["a@b.co", "app"])).toEqual(["a@b.co", "app", "me"]);
  });

  it("leaves a list that already has 'me' alone", () => {
    expect(withCreator(["a@b.co", "me"])).toEqual(["a@b.co", "me"]);
  });
});

describe("withCreatorInItems", () => {
  it("adds the creator to every item, nested tasks included", () => {
    expect(withCreatorInItems([
      { name: "a" },
      { name: "b", followers: ["x1"], tasks: [{ name: "b1" }, { name: "b2", followers: ["me"] }] },
    ])).toEqual([
      { name: "a", followers: ["me"] },
      {
        name: "b", followers: ["x1", "me"],
        tasks: [{ name: "b1", followers: ["me"] }, { name: "b2", followers: ["me"] }],
      },
    ]);
  });

  it("leaves a non-array followers for the server to reject", () => {
    expect(withCreatorInItems([{ name: "a", followers: "x1" }])).toEqual([{ name: "a", followers: "x1" }]);
  });

  it("leaves a non-array tasks as is", () => {
    expect(withCreatorInItems([{ name: "a", tasks: "oops" }])).toEqual([{ name: "a", followers: ["me"], tasks: "oops" }]);
  });
});
