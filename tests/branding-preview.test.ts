import assert from "assert"
import { describe, it } from "node:test"
import { buildBrandingStyles } from "../lib/invoices/branding"

describe("invoice branding", () => {
  it("applies default palette when preset is missing", () => {
    const styles = buildBrandingStyles()
    assert.ok(styles.headerStyle.backgroundColor)
    assert.ok(styles.accentStyle.color)
  })

  it("uses preset colors and terms", () => {
    const styles = buildBrandingStyles({
      name: "Corporate",
      primaryColor: "#123456",
      accentColor: "#abcdef",
      terms: "Net 30",
      logoUrl: "https://example.com/logo.png",
    })

    assert.strictEqual(styles.headerStyle.backgroundColor, "#123456")
    assert.strictEqual(styles.accentStyle.color, "#abcdef")
    assert.strictEqual(styles.terms, "Net 30")
    assert.strictEqual(styles.logoUrl, "https://example.com/logo.png")
  })
})
