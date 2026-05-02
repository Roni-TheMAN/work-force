import assert from "node:assert/strict";
import test from "node:test";

import { hasTimeManagementPermission, hasTimeReadPermission } from "./time-permissions";

test("hasTimeManagementPermission excludes payroll-only writers", () => {
  assert.equal(hasTimeManagementPermission(["payroll.write"]), false);
  assert.equal(hasTimeManagementPermission(["employee.write"]), true);
  assert.equal(hasTimeManagementPermission(["schedule.write"]), true);
});

test("hasTimeReadPermission allows payroll readers but not payroll writers alone", () => {
  assert.equal(hasTimeReadPermission(["payroll.read"]), true);
  assert.equal(hasTimeReadPermission(["payroll.write"]), false);
  assert.equal(hasTimeReadPermission(["employee.read"]), true);
  assert.equal(hasTimeReadPermission(["schedule.read"]), true);
});
