from app.routers.auth import router as auth_router
<<<<<<< HEAD
from app.routers.invoice import router as invoice_router

__all__ = ["auth_router", "invoice_router"]

=======
from app.routers.rooms import router as rooms_router
from app.routers.students import router as students_router

__all__ = ["auth_router", "rooms_router", "students_router"]
>>>>>>> 1be9ab389bf95f6bd1f614e0aa1a80b6415d9d06
