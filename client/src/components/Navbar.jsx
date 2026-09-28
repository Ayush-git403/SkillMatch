import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useRef, useEffect } from "react";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const dashboardPath =
    user?.role === "employer"
      ? "/employer"
      : "/applicant";

  return (
    <nav className="skillmatch-navbar">

      <div className="skillmatch-navbar-inner">

        {/* LOGO */}

        <Link
          to="/"
          className="skillmatch-logo"
        >
          <span>Skill</span>Match
        </Link>


        {/* NAVIGATION */}

        <div className="skillmatch-nav-links">

          {user?.role === "applicant" && (
            <>
              <Link
                to="/applicant"
                className="skillmatch-nav-link"
              >
                Find jobs
              </Link>

              <Link
                to="/applicant"
                className="skillmatch-nav-link"
              >
                My applications
              </Link>
            </>
          )}

          {user?.role === "employer" && (
            <Link
              to="/employer"
              className="skillmatch-nav-link"
            >
              Dashboard
            </Link>
          )}

        </div>


        {/* RIGHT SIDE */}

        <div className="skillmatch-navbar-right">

          {!user ? (
            <>
              <Link
                to="/login"
                className="navbar-login"
              >
                Login
              </Link>

              <Link
                to="/register"
                className="navbar-get-started"
              >
                Get started
              </Link>
            </>
          ) : (

            /* PROFILE */

            <div
              className="profile-wrapper"
              ref={profileRef}
            >

              <button
                className={
                  profileOpen
                    ? "profile-button open"
                    : "profile-button"
                }
                onClick={() =>
                  setProfileOpen(
                    !profileOpen
                  )
                }
                onMouseEnter={() =>
                  setProfileOpen(true)
                }
              >

                <div className="profile-text">

                  <span className="profile-name">
                    {user.name}
                  </span>

                  <span className="profile-role">
                    {user.role === "applicant"
                      ? "Job seeker"
                      : "Employer"}
                  </span>

                </div>


                <div className="profile-avatar">
                  {(user.name || "A")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <span
                  className={
                    profileOpen
                      ? "profile-arrow rotate"
                      : "profile-arrow"
                  }
                >
                  ↓
                </span>

              </button>


              {/* DROPDOWN */}

              {profileOpen && (

                <div
                  className="profile-dropdown"
                  onMouseLeave={() =>
                    setProfileOpen(false)
                  }
                >

                  <div className="dropdown-user">

                    <div className="dropdown-avatar">
                      {(user.name || "A")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>

                      <strong>
                        {user.name}
                      </strong>

                      <span>
                        {user.role ===
                        "applicant"
                          ? "Job seeker"
                          : "Employer"}
                      </span>

                    </div>

                  </div>


                  <div className="dropdown-divider" />


                  <Link
                    to={dashboardPath}
                    className="dropdown-item"
                    onClick={() =>
                      setProfileOpen(false)
                    }
                  >
                    <span className="dropdown-icon">
                      □
                    </span>

                    Dashboard
                  </Link>


                  <button
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    <span className="dropdown-icon">
                      ↪
                    </span>

                    Logout
                  </button>

                </div>

              )}

            </div>

          )}

        </div>

      </div>


      {/* CSS */}

      <style>{`

        /* ==========================================
           NAVBAR
        ========================================== */

        .skillmatch-navbar {
          width: 100%;
          height: 72px;

          background: #ffffff;

          border-bottom:
            1px solid #e6eaf0;

          position: sticky;
          top: 0;

          z-index: 1000;
        }


        .skillmatch-navbar-inner {
          max-width: 1440px;
          height: 100%;

          margin: 0 auto;

          padding: 0 40px;

          display: flex;
          align-items: center;
        }


        /* ==========================================
           LOGO
        ========================================== */

        .skillmatch-logo {
          color: #172033;

          text-decoration: none;

          font-size: 25px;
          font-weight: 800;

          letter-spacing: -1.2px;

          transition:
            opacity 0.2s ease;
        }

        .skillmatch-logo span {
          color: #2563eb;
        }

        .skillmatch-logo:hover {
          opacity: 0.8;
        }


        /* ==========================================
           NAV LINKS
        ========================================== */

        .skillmatch-nav-links {
          height: 100%;

          margin-left: 65px;

          display: flex;
          align-items: center;

          gap: 5px;
        }


        .skillmatch-nav-link {
          height: 100%;

          padding: 0 16px;

          display: flex;
          align-items: center;

          position: relative;

          color: #667085;

          text-decoration: none;

          font-size: 14px;
          font-weight: 500;

          transition:
            color 0.2s ease;
        }


        .skillmatch-nav-link:hover {
          color: #172033;
        }


        /* Blue line on hover */

        .skillmatch-nav-link::after {
          content: "";

          position: absolute;

          bottom: 0;

          left: 16px;
          right: 16px;

          height: 3px;

          background: #2563eb;

          border-radius:
            4px 4px 0 0;

          transform:
            scaleX(0);

          transition:
            transform 0.2s ease;
        }


        .skillmatch-nav-link:hover::after {
          transform:
            scaleX(1);
        }


        /* ==========================================
           RIGHT SIDE
        ========================================== */

        .skillmatch-navbar-right {
          margin-left: auto;

          display: flex;
          align-items: center;
        }


        .navbar-login {
          margin-right: 20px;

          color: #344054;

          text-decoration: none;

          font-size: 14px;
          font-weight: 600;
        }


        .navbar-login:hover {
          color: #2563eb;
        }


        .navbar-get-started {
          padding: 10px 17px;

          background: #2563eb;
          color: white;

          border-radius: 7px;

          text-decoration: none;

          font-size: 13px;
          font-weight: 700;
        }


        .navbar-get-started:hover {
          background: #1d4ed8;
        }


        /* ==========================================
           PROFILE
        ========================================== */

        .profile-wrapper {
          position: relative;
        }


        .profile-button {
          height: 54px;

          padding: 4px 5px 4px 13px;

          display: flex;
          align-items: center;

          gap: 11px;

          background: transparent;

          border: 1px solid transparent;

          border-radius: 10px;

          cursor: pointer;

          transition:
            background 0.2s ease,
            border-color 0.2s ease;
        }


        .profile-button:hover,
        .profile-button.open {
          background: #f8fafc;

          border-color: #e5e7eb;
        }


        .profile-text {
          display: flex;
          flex-direction: column;

          align-items: flex-end;

          line-height: 1.2;
        }


        .profile-name {
          color: #172033;

          font-size: 13px;
          font-weight: 600;
        }


        .profile-role {
          margin-top: 3px;

          color: #98a2b3;

          font-size: 11px;
        }


        /* ==========================================
           AVATAR
        ========================================== */

        .profile-avatar {
          width: 40px;
          height: 40px;

          display: flex;
          align-items: center;
          justify-content: center;

          background: #eff6ff;

          border: 1px solid #bfdbfe;

          border-radius: 50%;

          color: #2563eb;

          font-size: 14px;
          font-weight: 800;
        }


        /* ==========================================
           ARROW
        ========================================== */

        .profile-arrow {
          margin-left: 2px;

          color: #98a2b3;

          font-size: 12px;

          transition:
            transform 0.2s ease;
        }


        .profile-arrow.rotate {
          transform:
            rotate(180deg);
        }


        /* ==========================================
           DROPDOWN
        ========================================== */

        .profile-dropdown {
          position: absolute;

          top: calc(100% + 8px);
          right: 0;

          width: 220px;

          padding: 8px;

          background: #ffffff;

          border: 1px solid #e4e7ec;

          border-radius: 12px;

          box-shadow:
            0 12px 35px
            rgba(16, 24, 40, 0.12);

          animation:
            dropdownIn
            0.15s
            ease-out;
        }


        @keyframes dropdownIn {

          from {
            opacity: 0;
            transform:
              translateY(-5px);
          }

          to {
            opacity: 1;
            transform:
              translateY(0);
          }

        }


        /* ==========================================
           DROPDOWN USER
        ========================================== */

        .dropdown-user {
          padding: 10px;

          display: flex;
          align-items: center;

          gap: 10px;
        }


        .dropdown-avatar {
          width: 38px;
          height: 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          background: #eff6ff;

          border: 1px solid #dbeafe;

          border-radius: 50%;

          color: #2563eb;

          font-size: 13px;
          font-weight: 800;
        }


        .dropdown-user div:last-child {
          display: flex;
          flex-direction: column;
        }


        .dropdown-user strong {
          color: #172033;

          font-size: 13px;
        }


        .dropdown-user span {
          margin-top: 3px;

          color: #98a2b3;

          font-size: 11px;
        }


        /* ==========================================
           DIVIDER
        ========================================== */

        .dropdown-divider {
          height: 1px;

          margin:
            5px 0;

          background: #eaecf0;
        }


        /* ==========================================
           DROPDOWN ITEMS
        ========================================== */

        .dropdown-item {
          width: 100%;

          padding: 10px 11px;

          display: flex;
          align-items: center;

          gap: 10px;

          background: transparent;

          border: none;

          border-radius: 7px;

          color: #344054;

          text-decoration: none;

          font-size: 13px;

          text-align: left;

          cursor: pointer;
        }


        .dropdown-item:hover {
          background: #f8fafc;

          color: #2563eb;
        }


        .dropdown-icon {
          width: 20px;

          color: #667085;

          font-size: 15px;
        }


        .dropdown-item:hover .dropdown-icon {
          color: #2563eb;
        }


        .logout-item {
          color: #dc2626;
        }


        .logout-item:hover {
          background: #fef2f2;

          color: #dc2626;
        }


        /* ==========================================
           MOBILE
        ========================================== */

        @media (max-width: 700px) {

          .skillmatch-navbar-inner {
            padding: 0 18px;
          }


          .skillmatch-nav-links {
            display: none;
          }


          .profile-text {
            display: none;
          }


          .profile-button {
            padding-left: 5px;
          }

        }

      `}</style>
    </nav>
  );
};

export default Navbar;