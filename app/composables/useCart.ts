import { useState } from '#app'
import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { BitrixProduct } from '~/types'

export interface CartItem {
  id: string | number
  name: string
  price: number
  image: string | null
  quantity: number
}

/** Parses the stored cart, repairing items from older sessions that saved the image as an array or object. */
function readCart(raw: string): CartItem[] {
  let items: unknown
  try {
    items = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(items)) return []
  for (const item of items as { image: unknown }[]) {
    const image = item.image as { value?: string; showUrl?: string }[] | { value?: string; showUrl?: string } | null
    if (Array.isArray(image) && image.length > 0) {
      item.image = image[0]?.value || '/images/placeholder.png'
    } else if (typeof image === 'object' && image !== null && !Array.isArray(image)) {
      item.image = image.value || image.showUrl || '/images/placeholder.png'
    }
  }
  return items as CartItem[]
}

export const useCart = () => {
  // initOnMounted: the server always renders an empty cart, so the browser's first
  // render must too, or hydration mismatches. Without it a direct load of
  // /checkout poured the checkout form into the empty-cart markup.
  const cart = useLocalStorage<CartItem[]>('novel-cart-data', [], {
    initOnMounted: true,
    serializer: { read: readCart, write: (v) => JSON.stringify(v) },
  })
  const isCartOpen = useState<boolean>('novel-cart-open', () => false)

  const toggleCart = () => {
    isCartOpen.value = !isCartOpen.value
  }

  const addToCart = (product: BitrixProduct, qty = 1) => {
    const productId = product.ID || product.id
    const existingItem = cart.value.find((item: CartItem) => item.id === productId)

    if (existingItem) {
      existingItem.quantity += qty
    } else {
      let finalImage: any =
        product.PROPERTY_102 || product.PREVIEW_PICTURE || product.image || '/images/placeholder.png'
      if (Array.isArray(finalImage) && finalImage.length > 0 && finalImage[0].value) {
        finalImage = finalImage[0].value
      } else if (typeof finalImage === 'object' && finalImage !== null && finalImage.value) {
        finalImage = finalImage.value
      }

      cart.value.push({
        id: productId as string | number,
        name: (product.NAME || product.name || product.title || `Product ${productId}`) as string,
        price: Number(product.dealerPrice || product.PRICE || product.price || 0),
        image: typeof finalImage === 'string' ? finalImage : '/images/placeholder.png',
        quantity: qty,
      })
    }
    isCartOpen.value = true // Auto-open drawer when adding an item
  }

  const removeFromCart = (productId: string | number) => {
    cart.value = cart.value.filter((item: CartItem) => item.id !== productId)
  }

  const updateQuantity = (productId: string | number, amount: number) => {
    const item = cart.value.find((item: CartItem) => item.id === productId)
    if (item) {
      item.quantity += amount
      if (item.quantity <= 0) {
        removeFromCart(productId)
      }
    }
  }

  const cartItemCount = computed(() => {
    return cart.value.reduce((total: number, item: CartItem) => total + item.quantity, 0)
  })

  const cartTotalAmount = computed(() => {
    return cart.value.reduce((total: number, item: CartItem) => total + item.price * item.quantity, 0)
  })

  return {
    cart,
    isCartOpen,
    toggleCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    cartItemCount,
    cartTotalAmount,
  }
}
