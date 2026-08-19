# MOO Subscription Journey v2

## Product principle

Владелец не должен начинать с конфигурационного конструктора. Он должен выбрать понятную цель, получить рабочую основу, изменить только необходимое и увидеть результат до сохранения.

## End-to-end flow

| Stage | Owner question | Product surface |
|---|---|---|
| Start | Что я хочу запустить? | Three starts: готовый рацион, свой рацион, восстановить черновик. |
| Shape | Для кого и как часто? | One compact summary: meal slots, days/week, persons, period. |
| Menu | Что входит? | Dish/category selection hidden under `настроить состав`; defaults stay usable. |
| Economics | Сходится ли экономика? | Guest price, owner contribution, guest savings and warnings in one preview. |
| Save | Можно ли вернуться позже? | Autosaved local draft plus explicit `сохранить изменения`. |
| Publish | Готов ли гость увидеть план? | Separate confirmation with summary and `опубликовать`, never implicit. |

## UX rules

The first viewport shows the plan state, one recommended action and one compact summary. Advanced commercial controls, category limits and detailed dish selection are collapsed until requested. Buttons use one primary action per stage; secondary actions are links or quiet controls. The draft state is visible as `черновик сохранён`, and restoring a draft is explicit.

## Data boundary

The existing restaurant-scoped subscription config API remains the source of truth. The first draft layer is localStorage-scoped to restaurant/user/browser and never publishes automatically. Server persistence still requires the explicit save action. A future server-side draft table can extend this without changing the UI contract.
