// Minimal client-side PDF writer — embeds each page canvas as a full-page
// JPEG (DCTDecode) on a US Letter page. No dependencies; ~2 KB instead of
// shipping jsPDF for what is a fixed single-purpose document.

const PAGE_W = 612 // points (8.5in)
const PAGE_H = 792 // points (11in)

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function canvasesToPdfBlob(pages: HTMLCanvasElement[], quality = 0.92): Blob {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  let offset = 0
  const offsets: number[] = []
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data
    chunks.push(bytes)
    offset += bytes.length
  }
  const beginObj = (n: number) => {
    offsets[n] = offset
    push(`${n} 0 obj\n`)
  }

  const n = pages.length
  push('%PDF-1.4\n')
  // Binary comment marker so transfer tools treat the file as binary
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  beginObj(1)
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  beginObj(2)
  push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`)

  pages.forEach((canvas, i) => {
    const pageN = 3 + i * 3
    const contN = 4 + i * 3
    const imgN = 5 + i * 3
    const jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', quality))

    beginObj(pageN)
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /XObject << /Im${i} ${imgN} 0 R >> >> /Contents ${contN} 0 R >>\nendobj\n`
    )

    const stream = `q ${PAGE_W} 0 0 ${PAGE_H} 0 0 cm /Im${i} Do Q`
    beginObj(contN)
    push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`)

    beginObj(imgN)
    push(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    )
    push(jpeg)
    push('\nendstream\nendobj\n')
  })

  const xrefOffset = offset
  const total = 3 + n * 3 // object count including the free object 0
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`
  for (let i = 1; i < total; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' })
}
