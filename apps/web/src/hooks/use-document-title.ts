import { useEffect } from 'react'
import { da } from '@/i18n/da'

/**
 * Sets the browser tab title while the page is shown ("Havens historie · Produktionsplan"). The
 * print view passes `exact`, since browsers use the title as the PDF's file name.
 */
export function useDocumentTitle(title: string, { exact = false } = {}) {
  useEffect(() => {
    const previous = document.title
    document.title = exact ? title : `${title} · ${da.appName}`
    return () => {
      document.title = previous
    }
  }, [title, exact])
}
