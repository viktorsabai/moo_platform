export function Footer() {
  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">UFO Delivery</h3>
            <p className="text-gray-400">
              Доставка еды с возможностью подписки на регулярные доставки
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Навигация</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/menu" className="hover:text-white">Меню</a></li>
              <li><a href="/orders" className="hover:text-white">Заказы</a></li>
              <li><a href="/subscriptions" className="hover:text-white">Подписки</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Связь</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Telegram mini app — основной канал связи</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-4 text-center text-gray-400">
          <p>&copy; 2024 UFO Delivery. Все права защищены.</p>
        </div>
      </div>
    </footer>
  )
}




