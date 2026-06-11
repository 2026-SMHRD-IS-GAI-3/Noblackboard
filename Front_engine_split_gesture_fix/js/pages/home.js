import "../core/bootstrap.js";
import { requireActiveLogin } from "../core/auth.js";

if (requireActiveLogin("../index.html")) {
  void import("../home.js");
}
